import * as Constants from '../../utils/constants'
import Action, { IActionModel } from '../../models/action'
import IAction, { RedisClientType, ClientAction, ActionType, InputComment } from '../../types/action'
import {
    saveRedisAction,
    getRedisAction,
    saveRedisComment,
    actionExists,
    getRedisComment,
    deleteRedisComment,
    deleteRedisAction,
} from '../../utils/redis'
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

    createLiveAction = async (data: ClientAction, gameId: string, pointId: string): Promise<IAction> => {
        validateActionData(data)
        const actionNumber = await this.redisClient.incr(`${gameId}:${pointId}:actions`)
        const actionData = parseActionData(data, actionNumber)
        await saveRedisAction(this.redisClient, actionData, pointId)
        await this.handleSideEffects(data, gameId, pointId)
        // treat redis as source of truth always
        const action = await getRedisAction(this.redisClient, pointId, actionData.actionNumber)

        return action
    }

    getLiveAction = async (pointId: string, actionNumber: number): Promise<IAction> => {
        return await getRedisAction(this.redisClient, pointId, actionNumber)
    }

    undoAction = async (gameId: string, pointId: string, team: 'one' | 'two'): Promise<IAction | undefined> => {
        const totalActions = await this.redisClient.get(`${gameId}:${pointId}:actions`)
        const game = await this.gameModel.findById(gameId)
        if (!game) {
            throw new ApiError(Constants.UNABLE_TO_FIND_GAME, 404)
        }
        const teamId = team === 'one' ? game.teamOne._id : game.teamTwo._id
        if (!teamId) {
            throw new ApiError(Constants.INVALID_DATA, 400)
        }

        for (let i = Number(totalActions); i > 0; i--) {
            const exists = await actionExists(this.redisClient, pointId, i)
            if (!exists) {
                continue
            }
            const action = await getRedisAction(this.redisClient, pointId, i)
            if (action.team._id?.equals(teamId)) {
                await deleteRedisAction(this.redisClient, pointId, i)
                return action
            }
        }
        return
    }

    addLiveComment = async (pointId: string, actionNumber: number, data: InputComment): Promise<IAction> => {
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
        const exists = await actionExists(this.redisClient, pointId, actionNumber)
        if (!exists) {
            throw new ApiError(Constants.INVALID_DATA, 400)
        }
        if (filter.isProfane(data.comment)) {
            throw new ApiError(Constants.PROFANE_COMMENT, 400)
        }
        await saveRedisComment(this.redisClient, pointId, actionNumber, { comment, user })
        return await getRedisAction(this.redisClient, pointId, actionNumber)
    }

    deleteLiveComment = async (
        pointId: string,
        actionNumber: number,
        commentNumber: number,
        jwt: string,
    ): Promise<IAction> => {
        const response = await axios.get(`${this.ultmtUrl}/api/v1/user/me`, {
            headers: { 'X-API-Key': this.apiKey, Authorization: `Bearer ${jwt}` },
        })
        if (response.status !== 200) {
            throw new ApiError(Constants.UNAUTHENTICATED_USER, 401)
        }

        const comment = await getRedisComment(this.redisClient, pointId, actionNumber, commentNumber)
        if (!comment?.user._id?.equals(response.data._id)) {
            throw new ApiError(Constants.UNAUTHENTICATED_USER, 401)
        }

        await deleteRedisComment(this.redisClient, pointId, actionNumber, commentNumber)
        return await getRedisAction(this.redisClient, pointId, actionNumber)
    }

    private handleSideEffects = async (data: ClientAction, gameId: string, pointId: string) => {
        if (data.actionType === ActionType.SUBSTITUTION) {
            await handleSubstitute(data, gameId, pointId, this.pointModel, this.gameModel)
        }
    }
}
