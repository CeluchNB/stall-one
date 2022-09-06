import * as Constants from './constants'
import IAction, { ClientAction, ActionType, RedisClientType } from '../types/action'
import { Types } from 'mongoose'
import { Player } from '../types/ultmt'
import { ApiError } from '../types/errors'
import { IPointModel } from '../models/point'
import { IGameModel } from '../models/game'
import { deleteRedisAction } from './redis'

export const validateActionData = (data: ClientAction) => {
    const { playerOne, playerTwo } = data

    switch (data.actionType) {
        case ActionType.PULL:
        case ActionType.THROWAWAY:
        case ActionType.BLOCK:
        case ActionType.PICKUP:
        case ActionType.TIMEOUT:
        case ActionType.CALL_ON_FIELD:
            if (!playerOne || playerTwo) {
                throw new ApiError(Constants.INVALID_DATA, 400)
            }
            break
        case ActionType.CATCH:
        case ActionType.DROP:
        case ActionType.SCORE:
        case ActionType.SUBSTITUTION:
            if (!playerOne || !playerTwo) {
                throw new ApiError(Constants.INVALID_DATA, 400)
            }
            break
    }
}

export const parseActionData = (data: ClientAction, actionNumber: number): IAction => {
    return {
        ...data,
        pointId: new Types.ObjectId(data.pointId),
        actionNumber,
        displayMessage: getDisplayMessage(data.actionType, data.playerOne, data.playerTwo),
        comments: [],
    }
}

export const getDisplayMessage = (type: ActionType, playerOne?: Player, playerTwo?: Player): string => {
    switch (type) {
        case ActionType.PULL:
            return `${playerOne?.firstName} ${playerOne?.lastName} pulls the disc`
        case ActionType.CATCH:
            return `${playerOne?.firstName} ${playerOne?.lastName} throws to ${playerTwo?.firstName} ${playerTwo?.lastName}`
        default:
            return 'An action occurred'
    }
}

export const handleSubstitute = async (
    data: ClientAction,
    gameId: string,
    pointModel: IPointModel,
    gameModel: IGameModel,
) => {
    const point = await pointModel.findById(data.pointId)
    if (!point) {
        throw new ApiError(Constants.UNABLE_TO_FIND_POINT, 404)
    }
    const game = await gameModel.findById(gameId)
    if (!game) {
        throw new ApiError(Constants.UNABLE_TO_FIND_GAME, 404)
    }
    if (data.team._id?.toString() === game.teamOne._id?.toString()) {
        point.teamOnePlayers.push(data.playerTwo as Player)
    } else {
        point.teamTwoPlayers.push(data.playerTwo as Player)
    }
    await point.save()
}

export const handleScore = async (
    data: ClientAction,
    gameId: string,
    pointModel: IPointModel,
    gameModel: IGameModel,
    client: RedisClientType,
) => {
    const point = await pointModel.findById(data.pointId)
    if (!point) {
        throw new ApiError(Constants.UNABLE_TO_FIND_POINT, 404)
    }

    const game = await gameModel.findById(gameId)
    if (!game) {
        throw new ApiError(Constants.UNABLE_TO_FIND_GAME, 404)
    }

    if (data.team._id?.toString() === game.teamOne._id?.toString()) {
        point.teamOneScore += 1
        game.teamOneScore += 1
    } else {
        point.teamTwoScore += 1
        game.teamTwoScore += 1
    }

    await point.save()
    await game.save()
    const actions = await client.get(`${gameId}:${data.pointId}:actions`)
    for (let i = 1; i <= Number(actions); i++) {
        await deleteRedisAction(client, data.pointId, i)
    }
    await client.del(`${gameId}:${data.pointId}:actions`)
}
