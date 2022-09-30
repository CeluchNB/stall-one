import * as Constants from '../../utils/constants'
import Action, { IActionModel } from '../../models/action'
import { RedisClientType, ClientAction, ActionType, InputComment, RedisAction } from '../../types/action'
import {
    saveRedisAction,
    getRedisAction,
    saveRedisComment,
    actionExists,
    getRedisComment,
    deleteRedisComment,
    deleteRedisAction,
    getLastRedisAction,
    isPullingTeam,
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
    ): Promise<RedisAction> => {
        const totalActions = await this.redisClient.get(`${gameId}:${pointId}:${team}:actions`)
        if (!totalActions) {
            throw new ApiError(Constants.UNABLE_TO_FIND_POINT, 404)
        }

        // ensure this is a valid action to submit
        const prevAction = await getLastRedisAction(this.redisClient, gameId, pointId, team)
        const isPulling = await isPullingTeam(this.redisClient, gameId, pointId, team)
        validateActionData(data, isPulling, prevAction)
        // increment total actions and create new action
        const actionNumber = await this.redisClient.incr(`${gameId}:${pointId}:${team}:actions`)
        const actionData = parseActionData(data, actionNumber, team)
        await saveRedisAction(this.redisClient, actionData, pointId)
        await this.handleSideEffects(data, gameId, pointId, team)
        // treat redis as source of truth always
        const action = await getRedisAction(this.redisClient, pointId, actionData.actionNumber, team)

        return action
    }

    getLiveAction = async (pointId: string, actionNumber: number, team: TeamNumberString): Promise<RedisAction> => {
        return await getRedisAction(this.redisClient, pointId, actionNumber, team)
    }

    undoAction = async (gameId: string, pointId: string, team: TeamNumberString): Promise<RedisAction | undefined> => {
        const totalActions = await this.redisClient.get(`${gameId}:${pointId}:${team}:actions`)
        const game = await this.gameModel.findById(gameId)
        if (!game) {
            throw new ApiError(Constants.UNABLE_TO_FIND_GAME, 404)
        }

        const foundAction = await actionExists(this.redisClient, pointId, Number(totalActions), team)
        if (foundAction) {
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
    ): Promise<RedisAction> => {
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
    ): Promise<RedisAction> => {
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

    private handleSideEffects = async (data: ClientAction, gameId: string, pointId: string, team: TeamNumberString) => {
        if (data.actionType === ActionType.SUBSTITUTION) {
            await handleSubstitute(data, gameId, pointId, team, this.pointModel, this.gameModel)
        }
    }
}
