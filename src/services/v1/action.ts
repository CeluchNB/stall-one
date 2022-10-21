import * as Constants from '../../utils/constants'
import Action, { IActionModel } from '../../models/action'
import IAction, { RedisClientType, ClientAction, ActionType, InputComment, RedisAction } from '../../types/action'
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
import { Player, TeamNumberString } from '../../types/ultmt'
import { ApiError } from '../../types/errors'
import filter from '../../utils/bad-words-filter'
import { findByIdOrThrow } from '../../utils/mongoose'
import { authenticateManager, getUser } from '../../utils/ultmt'

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

    /**
     * Method to create a live action, stored in redis.
     * @param data content of action
     * @param gameId id of game action belongs to
     * @param pointId id of point action belongs to
     * @param team team reporting action
     * @returns redis action
     */
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

    /**
     * Method to get an action stored in redis.
     * @param pointId id of point action belongs to
     * @param actionNumber number of action on point
     * @param team team reporting action
     * @returns redis action
     */
    getLiveAction = async (pointId: string, actionNumber: number, team: TeamNumberString): Promise<RedisAction> => {
        return await getRedisAction(this.redisClient, pointId, actionNumber, team)
    }

    /**
     * Method to undo (delete) an action stored in redis.
     * @param gameId id of game action belongs to
     * @param pointId id of point action belongs to
     * @param team team reporting action
     * @returns deleted action or undefined if not found
     */
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

    /**
     * Method to add a comment to a live action
     * @param pointId id of point action belongs to
     * @param actionNumber action number to comment on
     * @param data content of comment
     * @param team team that reported action
     * @returns updated redis action
     */
    addLiveComment = async (
        pointId: string,
        actionNumber: number,
        data: InputComment,
        team: TeamNumberString,
    ): Promise<RedisAction> => {
        const { jwt, comment } = data
        const user = await getUser(this.ultmtUrl, this.apiKey, jwt)

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

    /**
     * Method to delete a live comment of action stored in redis
     * @param pointId id of point the action belongs to
     * @param actionNumber number of action on this point
     * @param commentNumber comment number on action
     * @param jwt jwt of commentor
     * @param team team of action
     * @returns updated redis action
     */
    deleteLiveComment = async (
        pointId: string,
        actionNumber: number,
        commentNumber: number,
        jwt: string,
        team: TeamNumberString,
    ): Promise<RedisAction> => {
        const user = await getUser(this.ultmtUrl, this.apiKey, jwt)

        const comment = await getRedisComment(this.redisClient, pointId, actionNumber, commentNumber, team)
        if (!comment?.user._id?.equals(user._id)) {
            throw new ApiError(Constants.UNAUTHENTICATED_USER, 401)
        }

        await deleteRedisComment(this.redisClient, pointId, actionNumber, commentNumber, team)
        return await getRedisAction(this.redisClient, pointId, actionNumber, team)
    }

    /**
     * Method to edit the players involved in a mongodb saved action.
     * @param actionId id of action to edit
     * @param userJwt jwt of editing user (must be team manager)
     * @param playerOne new player one
     * @param playerTwo new player two
     * @returns updated action
     */
    editSavedAction = async (
        actionId: string,
        userJwt?: string,
        playerOne?: Player,
        playerTwo?: Player,
    ): Promise<IAction> => {
        const action = await findByIdOrThrow<IAction>(actionId, this.actionModel, Constants.UNABLE_TO_FIND_ACTION)
        await authenticateManager(this.ultmtUrl, this.apiKey, userJwt, action.team._id?.toString())

        action.playerOne = playerOne
        action.playerTwo = playerTwo
        await action.save()
        return action
    }

    /**
     * Method to save comment on an action in mongodb
     * @param actionId id of action to comment on
     * @param userJwt jwt of commenting user
     * @param comment content of comment
     * @returns updated actio
     */
    addSavedComment = async (actionId: string, userJwt: string, comment: string): Promise<IAction> => {
        const action = await findByIdOrThrow<IAction>(actionId, this.actionModel, Constants.UNABLE_TO_FIND_ACTION)
        const user = await getUser(this.ultmtUrl, this.apiKey, userJwt)

        if (filter.isProfane(comment)) {
            throw new ApiError(Constants.PROFANE_COMMENT, 400)
        }

        const commentNumber = action.comments.length ? Math.max(...action.comments.map((c) => c.commentNumber)) + 1 : 1
        action.comments.push({ user, comment, commentNumber })
        await action.save()

        return action
    }

    /**
     * Method to delete a comment saved on an action in mongodb
     * @param actionId id of action to delete comment on
     * @param userJwt jwt of commenting user
     * @param commentNumber number of comment to delete
     * @returns updated action
     */
    deleteSavedComment = async (actionId: string, userJwt: string, commentNumber: number): Promise<IAction> => {
        const action = await findByIdOrThrow<IAction>(actionId, this.actionModel, Constants.UNABLE_TO_FIND_ACTION)
        const user = await getUser(this.ultmtUrl, this.apiKey, userJwt)

        action.comments = action.comments.filter((c) => {
            return !c.user._id?.equals(user._id) || c.commentNumber !== commentNumber
        })
        await action.save()

        return action
    }

    private handleSideEffects = async (data: ClientAction, gameId: string, pointId: string, team: TeamNumberString) => {
        if (data.actionType === ActionType.SUBSTITUTION) {
            await handleSubstitute(data, gameId, pointId, team, this.pointModel, this.gameModel)
        }
    }
}
