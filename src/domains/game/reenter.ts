import * as Constants from '../../utils/constants'
import Dependencies from '../../types/di'
import IGame, { GameStatus } from '../../types/game'
import { TeamNumber } from '../../types/ultmt'
import { findByIdOrThrow, idsAreEqual } from '../../utils/mongoose'
import { isTeamOne } from '../../utils/team'
import IPoint, { PointStatus } from '../../types/point'
import { Types } from 'mongoose'
import { getRedisAction, saveRedisAction } from '../../utils/redis'
import { sendCloudTask } from '../../utils/cloud-tasks'
import { RedisAction } from '../../types/action'
import { authenticateManager } from '../../utils/ultmt'

export const reenterGame = ({ gameModel, pointModel, actionModel, redisClient, ultmtUrl, apiKey }: Dependencies) => {
    const perform = async (
        gameId: string,
        userJwt: string,
        teamId: string,
    ): Promise<{ actions?: RedisAction[]; game: IGame; token: string; point?: IPoint }> => {
        await authenticateManager(ultmtUrl, apiKey, userJwt, teamId)
        // get game
        const game = await findByIdOrThrow<IGame>(gameId, gameModel, Constants.UNABLE_TO_FIND_GAME)
        const team = idsAreEqual(game.teamOne._id, teamId) ? TeamNumber.ONE : TeamNumber.TWO

        // get active point by team
        const point = await getReentryPoint(game._id, team)
        const teamStatus = isTeamOne(team, 'teamOneStatus', 'teamTwoStatus')
        const token = game.getToken(team)

        game[teamStatus] = GameStatus.ACTIVE
        await game.save()

        if (!point) {
            return { game, token }
        }

        // get actions by team
        if (point[teamStatus] === PointStatus.COMPLETE) {
            // get saved actions
            await reactivateCompletePoint(game, point, team)
            await point.save()
            // send delete stats to ultmt-stats - only do it here
            // could run into situation where delete is sent and fails,
            // exponential back off causes the request to stay in queue for long time
            // point gets submitted successfully with delete request still in queue
            await sendCloudTask(
                `/api/v1/stats/point/${point._id}/delete`,
                {
                    gameId: game._id,
                },
                'PUT',
            )
        }
        const actions = await getRedisActionsForPoint(game._id.toHexString(), point._id.toHexString(), team)

        return { game, point, actions, token }
    }

    const getReentryPoint = async (gameId: Types.ObjectId, team: TeamNumber) => {
        const activePoint = await getActivePoint(gameId, team)
        if (activePoint) return activePoint

        const completePoint = await getLastCompletePoint(gameId, team)
        if (completePoint) return completePoint
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

        await initializeRedisData(game, point, team, savedActions.length)
        // reload actions into redis
        const savePromises = []
        for (const action of savedActions) {
            savePromises.push(
                saveRedisAction(redisClient, { ...action.toJSON(), teamNumber: team }, point._id.toHexString()),
            )
        }
        await Promise.all(savePromises)
        // delete actions from db
        await actionModel.deleteMany({ pointId: point._id, 'team._id': teamId })
        // update team status
        point[teamStatus] = PointStatus.ACTIVE

        await updateScore(game._id, point)
    }

    const updateScore = async (gameId: Types.ObjectId, point: IPoint) => {
        const prevPoint = await pointModel.findOne({ gameId, pointNumber: point.pointNumber - 1 })
        if (prevPoint) {
            point.teamOneScore = prevPoint.teamOneScore
            point.teamTwoScore = prevPoint.teamTwoScore
        }
    }

    const initializeRedisData = async (game: IGame, point: IPoint, team: TeamNumber, actionCount: number) => {
        const gameId = game._id.toHexString()
        const pointId = point._id.toHexString()
        const pullingTeam = idsAreEqual(point.pullingTeam._id, game.teamOne._id) ? TeamNumber.ONE : TeamNumber.TWO
        const receivingTeam = isTeamOne(pullingTeam, TeamNumber.TWO, TeamNumber.ONE)
        await redisClient.set(`${gameId}:${pointId}:pulling`, pullingTeam)
        await redisClient.set(`${gameId}:${pointId}:receiving`, receivingTeam)
        await redisClient.set(`${gameId}:${pointId}:${team}:actions`, actionCount)
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
            reactivateCompletePoint,
            updateScore,
            initializeRedisData,
            getRedisActionsForPoint,
        },
    }
}

export type ReenterGame = ReturnType<typeof reenterGame>
