import * as Constants from './constants'
import { ClientAction, ActionType, VALID_ACTIONS, RedisAction } from '../types/action'
import { Player, TeamNumberString } from '../types/ultmt'
import { ApiError } from '../types/errors'
import { IPointModel } from '../models/point'
import { findByIdOrThrow } from './mongoose'
import IPoint from '../types/point'

export const validateActionData = (
    action: ClientAction,
    isPullingTeam?: boolean,
    prevAction?: ClientAction,
): boolean => {
    // Ensure current action is valid in this sequence
    if (!prevAction) {
        if (isPullingTeam && action.actionType !== ActionType.PULL) {
            throw new ApiError(Constants.INVALID_ACTION_TYPE, 400)
        } else if (
            !isPullingTeam &&
            ![ActionType.CATCH, ActionType.DROP, ActionType.PICKUP].includes(action.actionType)
        ) {
            throw new ApiError(Constants.INVALID_ACTION_TYPE, 400)
        }
    } else if (!VALID_ACTIONS[action.actionType].includes(prevAction.actionType)) {
        throw new ApiError(Constants.INVALID_ACTION_TYPE, 400)
    }

    const { playerOne, playerTwo, actionType } = action
    // ensure required data exists
    switch (actionType) {
        case ActionType.PULL:
        case ActionType.THROWAWAY:
        case ActionType.BLOCK:
        case ActionType.PICKUP:
            if (!playerOne || playerTwo) {
                throw new ApiError(Constants.INVALID_DATA, 400)
            }
            break
        case ActionType.SUBSTITUTION:
            if (!playerOne || !playerTwo) {
                throw new ApiError(Constants.INVALID_DATA, 400)
            }
            break
        case ActionType.CATCH:
        case ActionType.DROP:
        case ActionType.STALL:
            if (!playerOne) {
                throw new ApiError(Constants.INVALID_DATA, 400)
            }
            break
    }

    return true
}

export const parseActionData = (
    data: ClientAction,
    actionNumber: number,
    teamNumber: TeamNumberString,
): RedisAction => {
    return {
        ...data,
        actionNumber,
        teamNumber,
        comments: [],
    }
}

export const handleSubstitute = async (
    data: ClientAction,
    pointId: string,
    team: TeamNumberString,
    pointModel: IPointModel,
) => {
    const point = await pointModel.findById(pointId)
    if (!point) {
        throw new ApiError(Constants.UNABLE_TO_FIND_POINT, 404)
    }

    const subToRemove = data.playerOne
    const subToAdd = data.playerTwo
    if (!subToRemove || !subToAdd) {
        return
    }

    if (team === 'one') {
        point.teamOnePlayers.push(subToAdd)
        // active player logic is duplicated on the front end
        // if we change here, make sure to change on the frontend
        replacePlayerInArray(point.teamOneActivePlayers, subToRemove, subToAdd)
    } else {
        point.teamTwoPlayers.push(subToAdd)
        replacePlayerInArray(point.teamTwoActivePlayers, subToRemove, subToAdd)
    }
    await point.save()
}

export const undoSubstitute = async (
    data: ClientAction,
    pointId: string,
    team: TeamNumberString,
    pointModel: IPointModel,
) => {
    const point = await findByIdOrThrow<IPoint>(pointId, pointModel, Constants.UNABLE_TO_FIND_POINT)

    const subToRemove = data.playerTwo
    const subToAdd = data.playerOne
    if (!subToRemove || !subToAdd) {
        return
    }

    if (team === 'one') {
        removeSinglePlayerFromArray(point.teamOnePlayers, subToRemove)
        // active player logic is duplicated on the front end
        // if we change here, make sure to change on the frontend
        replacePlayerInArray(point.teamOneActivePlayers, subToRemove, subToAdd)
    } else {
        removeSinglePlayerFromArray(point.teamTwoPlayers, subToRemove)
        replacePlayerInArray(point.teamTwoActivePlayers, subToRemove, subToAdd)
    }
    await point.save()
}

const removeSinglePlayerFromArray = (players: Player[], playerToRemove: Player) => {
    const index = players.findIndex((player) => player._id?.equals(playerToRemove._id))
    players.splice(index, 1)
}

const replacePlayerInArray = (players: Player[], playerToRemove: Player, playerToAdd: Player) => {
    const index = players.findIndex((p) => p._id.equals(playerToRemove._id))
    players.splice(index, 1, playerToAdd)
}
