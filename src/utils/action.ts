import IAction, { ClientAction, ActionType } from '../types/action'
import { Types } from 'mongoose'
import { Player } from '../types/ultmt'

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
