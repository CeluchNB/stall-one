import { Types } from 'mongoose'
import { Player } from './ultmt'

export enum ActionType {
    PULL = 'Pull',
    CATCH = 'Catch',
    DROP = 'Drop',
    THROWAWAY = 'Throwaway',
    BLOCK = 'Block',
    PICKUP = 'Pickup',
    SCORE = 'Score',
    SUBSTITUTION = 'Substitution',
    CALL_ON_FIELD = 'CallOnField',
    UNDO = 'Undo',
    FINISH_GAME = 'FinishGame',
}

export interface Comment {
    user: Player
    comment: string
}

export interface ClientAction {
    pointId: Types.ObjectId
    eventType: ActionType
    team: Types.ObjectId
    playerOne?: Player
    playerTwo?: Player
    tags: string[]
}

interface IAction {
    _id: Types.ObjectId
    pointId: Types.ObjectId
    eventNumber: number
    eventType: ActionType
    displayMessage: string
    comments: Comment[]
    team: Types.ObjectId
    playerOne?: Player
    playerTwo?: Player
    tags: string[]
}

export default IAction
