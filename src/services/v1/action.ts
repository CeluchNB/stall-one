import * as Constants from '../../utils/constants'
import Action, { IActionModel } from '../../models/action'
import IAction, { RedisClientType, ClientAction, ActionType, InputComment } from '../../types/action'
import { saveRedisAction, getRedisAction, saveRedisComment, actionExists } from '../../utils/redis'
import { handleSubstitute, parseActionData, validateActionData } from '../../utils/action'
import Point, { IPointModel } from '../../models/point'
import Game, { IGameModel } from '../../models/game'
import axios from 'axios'
import { Player } from '../../types/ultmt'
import { ApiError } from '../../types/errors'
import filter from '../../utils/bad-words-filter'

export default class ActionServices {
    redisClient: RedisClientType
    actionModel: IActionModel
    pointModel: IPointModel
    gameModel: IGameModel
    ultmtUrl: string
    apiKey: string

    constructor(
        redisClient: RedisClientType,
        ultmtUrl: string,
        apiKey: string,
        actionModel: IActionModel = Action,
        pointModel: IPointModel = Point,
        gameModel: IGameModel = Game,
    ) {
        this.redisClient = redisClient
        this.ultmtUrl = ultmtUrl
        this.apiKey = apiKey
        this.actionModel = actionModel
        this.pointModel = pointModel
        this.gameModel = gameModel
    }

    createLiveAction = async (data: ClientAction, gameId: string): Promise<IAction> => {
        validateActionData(data)
        const actionNumber = await this.redisClient.incr(`${gameId}:${data.pointId}:actions`)
        const actionData = parseActionData(data, actionNumber)
        await saveRedisAction(this.redisClient, actionData)
        await this.handleSideEffects(data)
        // treat redis as source of truth always
        const action = await getRedisAction(this.redisClient, actionData.pointId.toString(), actionData.actionNumber)

        return action
    }

    getLiveAction = async (pointId: string, actionNumber: number): Promise<IAction> => {
        return await getRedisAction(this.redisClient, pointId, actionNumber)
    }

    addComment = async (pointId: string, actionNumber: number, data: InputComment): Promise<IAction> => {
        // TODO: Add user authentication
        const { jwt, comment } = data
        const response = await axios.get(`${this.ultmtUrl}/api/v1/user/me`, {
            headers: { 'X-API-Key': this.apiKey, Authorization: `Bearer ${jwt}` },
        })
        if (response.status !== 200) {
            throw new ApiError(Constants.UNAUTHENTICATED_USER, 401)
        }

        const user: Player = {
            ...response.data,
        }
        // TODO: Validate action exists
        const exists = await actionExists(this.redisClient, pointId, actionNumber)
        if (!exists) {
            throw new ApiError(Constants.INVALID_DATA, 400)
        }
        // TODO: Prevent inappropriate messages
        if (filter.isProfane(data.comment)) {
            throw new ApiError(Constants.PROFANE_COMMENT, 400)
        }
        await saveRedisComment(this.redisClient, pointId, actionNumber, { comment, user })
        return await getRedisAction(this.redisClient, pointId, actionNumber)
    }

    private handleSideEffects = async (data: ClientAction) => {
        if (data.actionType === ActionType.SUBSTITUTION) {
            await handleSubstitute(data, this.pointModel, this.gameModel)
        }
    }
}
