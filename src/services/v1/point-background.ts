import * as Constants from '../../utils/constants'
import { IActionModel } from '../../models/action'
import { IGameModel } from '../../models/game'
import { IPointModel } from '../../models/point'
import IPoint from '../../types/point'
import { sendCloudTask } from '../../utils/cloud-tasks'
import { findByIdOrThrow } from '../../utils/mongoose'
import { deleteRedisAction, getClient, getRedisAction } from '../../utils/redis'
import { TeamNumber, TeamNumberString } from '../../types/ultmt'
import IGame, { GameStatus } from '../../types/game'
import { RedisAction } from '../../types/action'
import { pointIsComplete } from '../../utils/point'

export default class PointBackgroundServices {
    pointModel: IPointModel
    gameModel: IGameModel
    actionModel: IActionModel

    constructor(opts: { pointModel: IPointModel; gameModel: IGameModel; actionModel: IActionModel }) {
        this.pointModel = opts.pointModel
        this.gameModel = opts.gameModel
        this.actionModel = opts.actionModel
    }

    finishPoint = async (pointId: string, gameId: string, team: TeamNumberString) => {
        const point = await findByIdOrThrow<IPoint>(pointId, this.pointModel, Constants.UNABLE_TO_FIND_POINT)
        const game = await findByIdOrThrow<IGame>(gameId, this.gameModel, Constants.UNABLE_TO_FIND_GAME)
        const redisClient = await getClient()

        const totalActions = await redisClient.get(`${gameId}:${pointId}:${team}:actions`)
        const redisActions = await this.getTeamActions(Number(totalActions), pointId, team)

        await this.moveActionsToDataStore(redisActions, team, game, point)
        await this.deleteRedisKeys(game, point, team)
        await this.deleteActions(Number(totalActions), pointId, team)

        await point.save()
        await this.submitStats(pointId, gameId)
    }

    getTeamActions = async (totalActions: number, pointId: string, team: TeamNumberString) => {
        const redisClient = await getClient()
        const redisActionPromises = []
        for (let i = 1; i <= totalActions; i++) {
            redisActionPromises.push(getRedisAction(redisClient, pointId, i, team))
        }

        return await Promise.all(redisActionPromises)
    }

    moveActionsToDataStore = async (
        redisActions: RedisAction[],
        teamNumber: TeamNumberString,
        game: IGame,
        point: IPoint,
    ) => {
        const team = teamNumber === TeamNumber.ONE ? game.teamOne : game.teamTwo
        await this.actionModel.create(redisActions.map((a) => ({ ...a, team: team, pointId: point._id })))
    }

    deleteRedisKeys = async (game: IGame, point: IPoint, team: TeamNumberString) => {
        const redisClient = await getClient()

        const gameId = game._id.toHexString()
        const pointId = point._id.toHexString()

        await redisClient.del(`${gameId}:${pointId}:${team}:actions`)
        if (game.teamTwoStatus !== GameStatus.ACTIVE) {
            await redisClient.del(`${gameId}:${pointId}:two:actions`)
        }

        if (pointIsComplete(point, game)) {
            await redisClient.del(`${gameId}:${pointId}:pulling`)
            await redisClient.del(`${gameId}:${pointId}:receiving`)
        }
    }

    deleteActions = async (totalActions: number, pointId: string, team: TeamNumberString) => {
        const redisClient = await getClient()
        const deleteActionPromises = []
        for (let i = 1; i <= Number(totalActions); i++) {
            deleteActionPromises.push(deleteRedisAction(redisClient, pointId, i, team as TeamNumberString))
        }
        await Promise.all(deleteActionPromises)
    }

    submitStats = async (pointId: string, gameId: string) => {
        const game = await findByIdOrThrow<IGame>(gameId, this.gameModel, Constants.UNABLE_TO_FIND_GAME)
        const updatedPoint = await findByIdOrThrow<IPoint>(pointId, this.pointModel, Constants.UNABLE_TO_FIND_POINT)
        if (pointIsComplete(updatedPoint, game)) {
            const teamOneActions = await this.actionModel.find({ pointId, 'team._id': game.teamOne._id })
            const teamTwoActions = await this.actionModel.find({ pointId, 'team._id': game.teamTwo._id })
            await sendCloudTask(
                '/api/v1/stats/point',
                {
                    point: {
                        pointId: updatedPoint._id,
                        gameId,
                        pullingTeam: updatedPoint.pullingTeam,
                        receivingTeam: updatedPoint.receivingTeam,
                        scoringTeam: updatedPoint.scoringTeam,
                        teamOnePlayers: updatedPoint.teamOnePlayers,
                        teamTwoPlayers: updatedPoint.teamTwoPlayers,
                        teamOneScore: updatedPoint.teamOneScore,
                        teamTwoScore: updatedPoint.teamTwoScore,
                        teamOneActions,
                        teamTwoActions,
                    },
                },
                'POST',
            )
        }
    }
}
