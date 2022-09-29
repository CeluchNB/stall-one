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
    TEAM_ONE_SCORE = 'TeamOneScore',
    TEAM_TWO_SCORE = 'TeamTwoScore',
    TIMEOUT = 'Timeout',
    SUBSTITUTION = 'Substitution',
    CALL_ON_FIELD = 'CallOnField',
}

// Each action type has an array of valid previous actions
export const VALID_ACTIONS = {
    Pull: [] as ActionType[],
    Catch: [ActionType.CATCH, ActionType.PICKUP, ActionType.TIMEOUT, ActionType.SUBSTITUTION, ActionType.CALL_ON_FIELD],
    Drop: [ActionType.CATCH, ActionType.PICKUP, ActionType.TIMEOUT, ActionType.SUBSTITUTION, ActionType.CALL_ON_FIELD],
    Throwaway: [
        ActionType.CATCH,
        ActionType.PICKUP,
        ActionType.TIMEOUT,
        ActionType.SUBSTITUTION,
        ActionType.CALL_ON_FIELD,
    ],
    Block: [
        ActionType.PULL,
        ActionType.DROP,
        ActionType.THROWAWAY,
        ActionType.TIMEOUT,
        ActionType.SUBSTITUTION,
        ActionType.CALL_ON_FIELD,
    ],
    Pickup: [
        ActionType.PULL,
        ActionType.BLOCK,
        ActionType.DROP,
        ActionType.THROWAWAY,
        ActionType.TIMEOUT,
        ActionType.SUBSTITUTION,
        ActionType.CALL_ON_FIELD,
    ],
    TeamOneScore: [
        ActionType.PULL,
        ActionType.CATCH,
        ActionType.PICKUP,
        ActionType.BLOCK,
        ActionType.DROP,
        ActionType.THROWAWAY,
        ActionType.TIMEOUT,
        ActionType.SUBSTITUTION,
        ActionType.CALL_ON_FIELD,
    ],
    TeamTwoScore: [
        ActionType.PULL,
        ActionType.CATCH,
        ActionType.PICKUP,
        ActionType.BLOCK,
        ActionType.DROP,
        ActionType.THROWAWAY,
        ActionType.TIMEOUT,
        ActionType.SUBSTITUTION,
        ActionType.CALL_ON_FIELD,
    ],
    Timeout: [
        ActionType.PULL,
        ActionType.CATCH,
        ActionType.PICKUP,
        ActionType.TIMEOUT,
        ActionType.SUBSTITUTION,
        ActionType.CALL_ON_FIELD,
    ],
    Substitution: [ActionType.CALL_ON_FIELD],
    CallOnField: [
        ActionType.PULL,
        ActionType.CATCH,
        ActionType.PICKUP,
        ActionType.BLOCK,
        ActionType.DROP,
        ActionType.THROWAWAY,
        ActionType.TIMEOUT,
        ActionType.SUBSTITUTION,
        ActionType.CALL_ON_FIELD,
    ],
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
