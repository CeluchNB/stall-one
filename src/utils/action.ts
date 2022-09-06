import * as Constants from './constants'
import IAction, { ClientAction, ActionType } from '../types/action'
import { Types } from 'mongoose'
import { Player } from '../types/ultmt'
import { ApiError } from '../types/errors'

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
