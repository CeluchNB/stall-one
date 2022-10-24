import * as Constants from './constants'
import { ClientAction, ActionType, VALID_ACTIONS, RedisAction } from '../types/action'
import { Player, TeamNumberString } from '../types/ultmt'
import { ApiError } from '../types/errors'
import { IPointModel } from '../models/point'
import { IGameModel } from '../models/game'

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
    } else {
        if (!VALID_ACTIONS[action.actionType].includes(prevAction.actionType)) {
            throw new ApiError(Constants.INVALID_ACTION_TYPE, 400)
        }
    }

    const { playerOne, playerTwo, actionType } = action
    // ensure required data exists
    switch (actionType) {
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
        case ActionType.SUBSTITUTION:
            if (!playerOne || !playerTwo) {
                throw new ApiError(Constants.INVALID_DATA, 400)
            }
            break
        case ActionType.CATCH:
        case ActionType.DROP:
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
    pointId: string,
    team: TeamNumberString,
    pointModel: IPointModel,
    gameModel: IGameModel,
) => {
    const point = await pointModel.findById(pointId)
    if (!point) {
        throw new ApiError(Constants.UNABLE_TO_FIND_POINT, 404)
    }
    const game = await gameModel.findById(gameId)
    if (!game) {
        throw new ApiError(Constants.UNABLE_TO_FIND_GAME, 404)
    }
    if (team === 'one') {
        point.teamOnePlayers.push(data.playerTwo as Player)
    } else {
        point.teamTwoPlayers.push(data.playerTwo as Player)
    }
    await point.save()
}
