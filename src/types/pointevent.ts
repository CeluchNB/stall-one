import { Types } from 'mongoose'
import { Player } from './ultmt'

export enum EventType {
    PULL = 'Pull',
    CATCH = 'Catch',
    DROP = 'Drop',
    THROWAWAY = 'Throwaway',
    BLOCK = 'Block',
    PICKUP = 'Pickup',
    SCORE = 'Score',
    SUBSTITUTION = 'Substitution',
    CALL_ON_FIELD = 'CallOnField',
    FINISH_GAME = 'FinishGame',
}

interface Comment {
    user: Player
    comment: string
}

interface IPointEvent {
    _id: Types.ObjectId
    pointId: Types.ObjectId
    eventNumber: number
    eventType: EventType
    displayMessage: string
    comments: Comment[]
    team: Types.ObjectId
    playerOne?: Player
    playerTwo?: Player
    tags: string[]
}

export default IPointEvent
