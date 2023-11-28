import * as Constants from '../../utils/constants'
import { subscribe } from '../../loaders/redis'
import { IActionModel } from '../../models/action'
import { IGameModel } from '../../models/game'
import { IPointModel } from '../../models/point'
import { RedisClientType } from '../../types/action'
import IPoint from '../../types/point'
import { sendCloudTask } from '../../utils/cloud-tasks'
import { findByIdOrThrow } from '../../utils/mongoose'
import { deleteRedisAction, getClient, getRedisAction } from '../../utils/redis'
import { TeamNumber, TeamNumberString } from '../../types/ultmt'
import IGame from '../../types/game'

export default class PointBackgroundServices {
    pointModel: IPointModel
    gameModel: IGameModel
    actionModel: IActionModel

    constructor(pointModel: IPointModel, gameModel: IGameModel, actionModel: IActionModel) {
        this.pointModel = pointModel
        this.gameModel = gameModel
        this.actionModel = actionModel

        subscribe('point-finish', this.finishPoint)
    }

    finishPoint = async (message: string) => {
        console.log('got finish point', message)
        const elements = message.split(':')
        const gameId = elements[1]
        const pointId = elements[3]
        const team = elements[5]

        const redisClient = await getClient()

        const point = await findByIdOrThrow<IPoint>(pointId, this.pointModel, Constants.UNABLE_TO_FIND_POINT)

        const game = await findByIdOrThrow<IGame>(gameId, this.gameModel, Constants.UNABLE_TO_FIND_GAME)

        const totalActions = await redisClient.get(`${gameId}:${pointId}:${team}:actions`)

        const redisActionPromises = []
        for (let i = 1; i <= Number(totalActions); i++) {
            redisActionPromises.push(getRedisAction(redisClient, pointId, i, team as TeamNumberString))
        }

        const redisActions = await Promise.all(redisActionPromises)

        if (team === TeamNumber.ONE) {
            const actions = await this.actionModel.create(redisActions.map((a) => ({ ...a, team: game.teamOne })))
            point.teamOneActions = actions.map((a) => a._id)
            point.teamOneActive = false
        } else {
            const actions = await this.actionModel.create(redisActions.map((a) => ({ ...a, team: game.teamTwo })))
            point.teamTwoActions = actions.map((a) => a._id)
            point.teamTwoActive = false
        }

        await point?.save()
        await game?.save()

        await redisClient.del(`${gameId}:${pointId}:${team}:actions`)
        if (!game.teamTwoActive) {
            await redisClient.del(`${gameId}:${pointId}:two:actions`)
        }

        if (!point.teamOneActive && !point.teamTwoActive) {
            await redisClient.del(`${gameId}:${pointId}:pulling`)
            await redisClient.del(`${gameId}:${pointId}:receiving`)
        }

        const deleteActionPromises = []
        for (let i = 1; i <= Number(totalActions); i++) {
            deleteActionPromises.push(deleteRedisAction(redisClient, pointId, i, team as TeamNumberString))
        }
        await Promise.all(deleteActionPromises)

        // use updated point to prevent race condition where points are updated at the same time
        // and one team still shows as active when it's not
        // TODO: rework this whole function
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
