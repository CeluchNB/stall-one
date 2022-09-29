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
import { Player, TeamNumberString } from '../../types/ultmt'
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

    createLiveAction = async (
        data: ClientAction,
        gameId: string,
        pointId: string,
        team: TeamNumberString,
    ): Promise<IAction> => {
        validateActionData(data)
        const actionNumber = await this.redisClient.incr(`${gameId}:${pointId}:${team}:actions`)
        const actionData = parseActionData(data, actionNumber)
        await saveRedisAction(this.redisClient, actionData, pointId, team)
        await this.handleSideEffects(data, gameId, pointId)
        // treat redis as source of truth always
        const action = await getRedisAction(this.redisClient, pointId, actionData.actionNumber, team)

        return action
    }

    getLiveAction = async (pointId: string, actionNumber: number, team: TeamNumberString): Promise<IAction> => {
        return await getRedisAction(this.redisClient, pointId, actionNumber, team)
    }

    undoAction = async (gameId: string, pointId: string, team: TeamNumberString): Promise<IAction | undefined> => {
        const totalActions = await this.redisClient.get(`${gameId}:${pointId}:${team}:actions`)
        const game = await this.gameModel.findById(gameId)
        if (!game) {
            throw new ApiError(Constants.UNABLE_TO_FIND_GAME, 404)
        }

        if (Number(totalActions) > 0) {
            const action = await getRedisAction(this.redisClient, pointId, Number(totalActions), team)
            await deleteRedisAction(this.redisClient, pointId, Number(totalActions), team)
            await this.redisClient.decr(`${gameId}:${pointId}:${team}:actions`)
            return action
        }
        return
    }

    addLiveComment = async (
        pointId: string,
        actionNumber: number,
        data: InputComment,
        team: TeamNumberString,
    ): Promise<IAction> => {
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
        const exists = await actionExists(this.redisClient, pointId, actionNumber, team)
        if (!exists) {
            throw new ApiError(Constants.INVALID_DATA, 400)
        }
        if (filter.isProfane(data.comment)) {
            throw new ApiError(Constants.PROFANE_COMMENT, 400)
        }
        await saveRedisComment(this.redisClient, pointId, actionNumber, { comment, user }, team)
        return await getRedisAction(this.redisClient, pointId, actionNumber, team)
    }

    deleteLiveComment = async (
        pointId: string,
        actionNumber: number,
        commentNumber: number,
        jwt: string,
        team: TeamNumberString,
    ): Promise<IAction> => {
        const response = await axios.get(`${this.ultmtUrl}/api/v1/user/me`, {
            headers: { 'X-API-Key': this.apiKey, Authorization: `Bearer ${jwt}` },
        })
        if (response.status !== 200) {
            throw new ApiError(Constants.UNAUTHENTICATED_USER, 401)
        }

        const comment = await getRedisComment(this.redisClient, pointId, actionNumber, commentNumber, team)
        if (!comment?.user._id?.equals(response.data._id)) {
            throw new ApiError(Constants.UNAUTHENTICATED_USER, 401)
        }

        await deleteRedisComment(this.redisClient, pointId, actionNumber, commentNumber, team)
        return await getRedisAction(this.redisClient, pointId, actionNumber, team)
    }

    private handleSideEffects = async (data: ClientAction, gameId: string, pointId: string) => {
        if (data.actionType === ActionType.SUBSTITUTION) {
            await handleSubstitute(data, gameId, pointId, this.pointModel, this.gameModel)
        }
    }
}
