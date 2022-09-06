import * as Constants from '../../utils/constants'
import Action, { IActionModel } from '../../models/action'
import IAction, { RedisClientType, ClientAction, ActionType } from '../../types/action'
import { saveRedisAction, getRedisAction } from '../../utils/redis'
import { handleScore, handleSubstitute, parseActionData, validateActionData } from '../../utils/action'
import Point, { IPointModel } from '../../models/point'
import Game, { IGameModel } from '../../models/game'
import { ApiError } from '../../types/errors'
import { Player } from '../../types/ultmt'

export default class ActionServices {
    redisClient: RedisClientType
    actionModel: IActionModel
    pointModel: IPointModel
    gameModel: IGameModel

    constructor(
        redisClient: RedisClientType,
        actionModel: IActionModel = Action,
        pointModel: IPointModel = Point,
        gameModel: IGameModel = Game,
    ) {
        this.redisClient = redisClient
        this.actionModel = actionModel
        this.pointModel = pointModel
        this.gameModel = gameModel
    }

    createLiveAction = async (data: ClientAction, gameId: string): Promise<IAction> => {
        validateActionData(data)
        const actionNumber = await this.redisClient.incr(`${gameId}:${data.pointId}:actions`)
        const actionData = parseActionData(data, actionNumber)
        await saveRedisAction(this.redisClient, actionData)
        if (data.actionType === ActionType.SUBSTITUTION) {
            await handleSubstitute(data, gameId, this.pointModel, this.gameModel)
        } else if (data.actionType === ActionType.SCORE) {
            await handleScore(data, gameId, this.pointModel, this.gameModel, this.redisClient)
        }
        // treat redis as source of truth always
        const action = await getRedisAction(this.redisClient, actionData.pointId.toString(), actionData.actionNumber)

        return action
    }

    getLiveAction = async (pointId: string, number: number): Promise<IAction> => {
        return await getRedisAction(this.redisClient, pointId, number)
    }
}
