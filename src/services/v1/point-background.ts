import * as Constants from '../../utils/constants'
import { IActionModel } from '../../models/action'
import { IGameModel } from '../../models/game'
import { IPointModel } from '../../models/point'
import IPoint from '../../types/point'
import { sendCloudTask } from '../../utils/cloud-tasks'
import { findByIdOrThrow } from '../../utils/mongoose'
import { deleteRedisAction, getClient, getRedisAction } from '../../utils/redis'
import { TeamNumber, TeamNumberString } from '../../types/ultmt'
import IGame from '../../types/game'
import { RedisAction } from '../../types/action'

export default class PointBackgroundServices {
    pointModel: IPointModel
    gameModel: IGameModel
    actionModel: IActionModel

    constructor(pointModel: IPointModel, gameModel: IGameModel, actionModel: IActionModel) {
        this.pointModel = pointModel
        this.gameModel = gameModel
        this.actionModel = actionModel
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
        team: TeamNumberString,
        game: IGame,
        point: IPoint,
    ) => {
        if (team === TeamNumber.ONE) {
            const actions = await this.actionModel.create(redisActions.map((a) => ({ ...a, team: game.teamOne })))
            point.teamOneActions = actions.map((a) => a._id)
        } else {
            const actions = await this.actionModel.create(redisActions.map((a) => ({ ...a, team: game.teamTwo })))
            point.teamTwoActions = actions.map((a) => a._id)
        }
    }

    deleteRedisKeys = async (game: IGame, point: IPoint, team: TeamNumberString) => {
        const redisClient = await getClient()

        const gameId = game._id.toHexString()
        const pointId = point._id.toHexString()

        await redisClient.del(`${gameId}:${pointId}:${team}:actions`)
        if (!game.teamTwoActive) {
            await redisClient.del(`${gameId}:${pointId}:two:actions`)
        }

        if (!point.teamOneActive && !point.teamTwoActive) {
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
        const updatedPoint = await findByIdOrThrow<IPoint>(pointId, this.pointModel, Constants.UNABLE_TO_FIND_POINT)
        if (!updatedPoint.teamOneActive && !updatedPoint.teamTwoActive) {
            const teamOneActions = await this.actionModel.find().where('_id').in(updatedPoint.teamOneActions)
            const teamTwoActions = await this.actionModel.find().where('_id').in(updatedPoint.teamTwoActions)
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
