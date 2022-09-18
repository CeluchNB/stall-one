import { Types } from 'mongoose'
import { Player, Team } from './ultmt'
import { createClient } from 'redis'

export enum ActionType {
    PULL = 'Pull',
    CATCH = 'Catch',
    DROP = 'Drop',
    THROWAWAY = 'Throwaway',
    BLOCK = 'Block',
    PICKUP = 'Pickup',
    SCORE = 'Score',
    TIMEOUT = 'Timeout',
    SUBSTITUTION = 'Substitution',
    CALL_ON_FIELD = 'CallOnField',
    FINISH_GAME = 'FinishGame',
}

export interface InputComment {
    jwt: string
    comment: string
}
export interface Comment {
    user: Player
    comment: string
}

export interface ClientAction {
    actionType: ActionType
    team: Team
    playerOne?: Player
    playerTwo?: Player
    tags: string[]
}

interface IAction {
    _id?: Types.ObjectId
    actionNumber: number
    actionType: ActionType
    displayMessage: string
    comments: Comment[]
    team: Team
    playerOne?: Player
    playerTwo?: Player
    tags: string[]
}

export type RedisClientType = ReturnType<typeof createClient>

export default IAction
