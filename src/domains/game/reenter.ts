import * as Constants from '../../utils/constants'
import Dependencies from '../../types/di'
import IGame, { GameStatus } from '../../types/game'
import { TeamNumber } from '../../types/ultmt'
import { findByIdOrThrow } from '../../utils/mongoose'
import { isTeamOne } from '../../utils/team'
import IPoint, { PointStatus } from '../../types/point'
import { Types } from 'mongoose'
import { ApiError } from '../../types/errors'
import { getRedisAction, saveRedisAction } from '../../utils/redis'

export const reenterGame = ({ gameModel, pointModel, actionModel, redisClient }: Dependencies) => {
    const perform = async (gameId: string, team: TeamNumber) => {
        // get game
        const game = await findByIdOrThrow<IGame>(gameId, gameModel, Constants.UNABLE_TO_FIND_GAME)

        // get active point by team
        const point = await getReentryPoint(game._id, team)

        // get actions by team
        const teamStatus = isTeamOne(team, 'teamOneStatus', 'teamTwoStatus')
        if (point[teamStatus] === PointStatus.COMPLETE) {
            // get saved actions
            await reactivateCompletePoint(game, point, team)
            // TODO: send delete stats to ultmt-stats - only do it here
            // could run into situation where delete is sent and fails,
            // exponential back off causes the request to stay in queue for long time
            // point gets submitted successfully with delete request still in queue
        }
        const actions = await getRedisActionsForPoint(game._id.toHexString(), point._id.toHexString(), team)

        const token = game.getToken(team)
        game[teamStatus] = GameStatus.ACTIVE
        await game.save()
        await point.save()

        return { game, point, actions, token }
    }

    const getReentryPoint = async (gameId: Types.ObjectId, team: TeamNumber) => {
        const activePoint = await getActivePoint(gameId, team)
        if (activePoint) return activePoint

        const completePoint = await getLastCompletePoint(gameId, team)
        if (completePoint) return completePoint

        throw new ApiError(Constants.UNABLE_TO_FIND_POINT, 404)
    }

    const getActivePoint = async (gameId: Types.ObjectId, team: TeamNumber) => {
        const activeTeamStatus = isTeamOne(
            team,
            { teamOneStatus: PointStatus.ACTIVE },
            { teamTwoStatus: PointStatus.ACTIVE },
        )
        const activePoint = await pointModel.findOne({ gameId: gameId, ...activeTeamStatus })
        return activePoint
    }

    const getLastCompletePoint = async (gameId: Types.ObjectId, team: TeamNumber) => {
        const completeTeamStatus = isTeamOne(
            team,
            { teamOneStatus: PointStatus.COMPLETE },
            { teamTwoStatus: PointStatus.COMPLETE },
        )
        const completePoint = await pointModel.findOne({ gameId: gameId, ...completeTeamStatus }).sort('-pointNumber')
        return completePoint
    }

    const reactivateCompletePoint = async (game: IGame, point: IPoint, team: TeamNumber) => {
        const teamStatus = isTeamOne(team, 'teamOneStatus', 'teamTwoStatus')
        const teamId = isTeamOne(team, game.teamOne._id, game.teamTwo._id)
        const savedActions = await actionModel.find({ pointId: point._id, 'team._id': teamId })
        // reload actions into redis
        const savePromises = []
        for (const action of savedActions) {
            savePromises.push(saveRedisAction(redisClient, { ...action, teamNumber: team }, point._id.toHexString()))
        }
        await Promise.all(savePromises)
        // delete actions from db
        await actionModel.deleteMany({ pointId: point._id, 'team._id': teamId })
        // update team status
        point[teamStatus] = PointStatus.ACTIVE
    }

    const getRedisActionsForPoint = async (gameId: string, pointId: string, team: TeamNumber) => {
        const actionCount = await redisClient.get(`${gameId}:${pointId}:${team}:actions`)
        const actionPromises = []
        for (let i = 1; i <= Number(actionCount); i++) {
            actionPromises.push(getRedisAction(redisClient, pointId, i, team))
        }
        return await Promise.all(actionPromises)
    }

    return {
        perform,
        helpers: {
            getReentryPoint,
            getActivePoint,
            getLastCompletePoint,
            getRedisActionsForPoint,
        },
    }
}

export type ReenterGame = ReturnType<typeof reenterGame>
