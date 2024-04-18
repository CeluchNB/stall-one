import * as Constants from '../../../utils/constants'
import Dependencies from '../../../types/di'
import { ApiError } from '../../../types/errors'
import IPoint, { PointStatus } from '../../../types/point'
import { TeamNumber } from '../../../types/ultmt'
import IAction, { RedisAction } from '../../../types/action'
import { saveRedisAction } from '../../../utils/redis'
import { findByIdOrThrow, idsAreEqual } from '../../../utils/mongoose'
import IGame from '../../../types/game'

export const backPoint = ({ gameModel, pointModel, actionModel, redisClient }: Dependencies) => {
    const perform = async (
        gameId: string,
        pointNumber: number,
        team: TeamNumber,
    ): Promise<{ point: IPoint; actions: IAction[] }> => {
        const game = await findByIdOrThrow<IGame>(gameId, gameModel, Constants.UNABLE_TO_FIND_GAME)
        const point = await findPointByGameAndNumber(gameId, pointNumber)
        const prevPoint = await findPointByGameAndNumber(gameId, pointNumber - 1)

        const status = team === 'one' ? 'teamOneStatus' : 'teamTwoStatus'
        validatePointStatus(point, status, PointStatus.ACTIVE)
        validatePointStatus(prevPoint, status, PointStatus.COMPLETE)

        point[status] = PointStatus.FUTURE
        prevPoint[status] = PointStatus.ACTIVE

        if (pointIsInactive(point)) {
            updateScores(point, game, prevPoint)
            await deleteRedisData(gameId, point._id.toHexString())
        }

        await game.save()
        await point.save()
        await prevPoint.save()

        // setup new redis data
        const pullingTeam = getPullingTeam(prevPoint, game)
        await setRedisData(gameId, prevPoint._id.toHexString(), pullingTeam)

        const actions = await transferActionsToRedis(game, prevPoint, team)

        return { point: prevPoint, actions }
    }

    const findPointByGameAndNumber = async (gameId: string, pointNumber: number) => {
        const point = await pointModel.findOne({ gameId, pointNumber })
        if (!point) throw new ApiError(Constants.UNABLE_TO_FIND_POINT, 404)
        return point
    }

    const validatePointStatus = (point: IPoint, teamStatus: keyof IPoint, status: PointStatus) => {
        if (point[teamStatus] !== status) throw new ApiError(Constants.CANNOT_GO_BACK_POINT, 400)
    }

    const pointIsInactive = (point: IPoint) => {
        return point.teamOneStatus !== PointStatus.ACTIVE && point.teamTwoStatus !== PointStatus.ACTIVE
    }

    const updateScores = (point: IPoint, game: IGame, prevPoint: IPoint) => {
        point.teamOneScore = prevPoint.teamOneScore
        point.teamTwoScore = prevPoint.teamTwoScore
        game.teamOneScore = prevPoint.teamOneScore
        game.teamTwoScore = prevPoint.teamTwoScore
    }

    const deleteRedisData = async (gameId: string, pointId: string) => {
        await redisClient.del(`${gameId}:${pointId}:one:actions`)
        await redisClient.del(`${gameId}:${pointId}:two:actions`)
        await redisClient.del(`${gameId}:${pointId}:pulling`)
        await redisClient.del(`${gameId}:${pointId}:receiving`)
    }

    const transferActionsToRedis = async (game: IGame, prevPoint: IPoint, team: TeamNumber): Promise<IAction[]> => {
        const myTeam = team === TeamNumber.ONE ? game.teamOne : game.teamTwo
        const actions = await actionModel.find({ pointId: prevPoint._id, 'team._id': myTeam._id })
        await saveActions(actions, game._id.toHexString(), prevPoint._id.toHexString(), team)
        await actionModel.deleteMany({ pointId: prevPoint._id, 'team._id': myTeam._id })

        return actions
    }

    const setRedisData = async (gameId: string, pointId: string, pullingTeam: TeamNumber) => {
        const receivingTeam = pullingTeam === 'one' ? 'two' : 'one'
        await redisClient.set(`${gameId}:${pointId}:pulling`, pullingTeam)
        await redisClient.set(`${gameId}:${pointId}:receiving`, receivingTeam)
    }

    const getPullingTeam = (prevPoint: IPoint, game: IGame): TeamNumber => {
        return idsAreEqual(prevPoint.pullingTeam._id, game.teamOne._id) ? TeamNumber.ONE : TeamNumber.TWO
    }

    const saveActions = async (actions: IAction[], gameId: string, pointId: string, teamNumber: TeamNumber) => {
        await redisClient.set(`${gameId}:${pointId}:${teamNumber}:actions`, actions.length)
        for (const action of actions) {
            const redisAction: RedisAction = {
                teamNumber,
                actionNumber: action.actionNumber,
                actionType: action.actionType,
                comments: action.comments,
                tags: action.tags,
                playerOne: action.playerOne,
                playerTwo: action.playerTwo,
            }
            await saveRedisAction(redisClient, redisAction, pointId)
        }
    }

    return {
        perform,
        helpers: {
            findPointByGameAndNumber,
            validatePointStatus,
            pointIsInactive,
            updateScores,
            deleteRedisData,
            transferActionsToRedis,
            setRedisData,
            getPullingTeam,
            saveActions,
        },
    }
}

export type BackPoint = ReturnType<typeof backPoint>
