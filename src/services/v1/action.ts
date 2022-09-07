import Action, { IActionModel } from '../../models/action'
import IAction, { RedisClientType, ClientAction, ActionType } from '../../types/action'
import { saveRedisAction, getRedisAction } from '../../utils/redis'
import { handleSubstitute, parseActionData, validateActionData } from '../../utils/action'
import Point, { IPointModel } from '../../models/point'
import Game, { IGameModel } from '../../models/game'

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
        await this.handleSideEffects(data, gameId)
        // treat redis as source of truth always
        const action = await getRedisAction(this.redisClient, actionData.pointId.toString(), actionData.actionNumber)

        return action
    }

    getLiveAction = async (pointId: string, number: number): Promise<IAction> => {
        return await getRedisAction(this.redisClient, pointId, number)
    }

    private handleSideEffects = async (data: ClientAction, gameId: string) => {
        if (data.actionType === ActionType.SUBSTITUTION) {
            await handleSubstitute(data, gameId, this.pointModel, this.gameModel)
        }
    }
}
