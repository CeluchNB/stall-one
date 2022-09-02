import Action, { IActionModel } from '../../models/action'
import IAction, { RedisClientType, ClientAction } from '../../types/action'
import { saveRedisAction, getRedisAction } from '../../utils/redis'
import { parseActionData } from '../../utils/action'

export default class ActionServices {
    redisClient: RedisClientType
    actionModel: IActionModel

    constructor(redisClient: RedisClientType, actionModel: IActionModel = Action) {
        this.redisClient = redisClient
        this.actionModel = actionModel
    }

    createLiveAction = async (data: ClientAction, gameId: string): Promise<IAction> => {
        const actionNumber = await this.redisClient.incr(`${gameId}:${data.pointId}:actions`)
        const actionData = parseActionData(data, actionNumber)
        await saveRedisAction(this.redisClient, actionData)
        // treat redis as source of truth always
        const action = await getRedisAction(this.redisClient, actionData.pointId.toString(), actionData.actionNumber)

        return action
    }

    getLiveAction = async (pointId: string, number: number): Promise<IAction> => {
        return await getRedisAction(this.redisClient, pointId, number)
    }
}
