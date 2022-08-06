import { Types } from 'mongoose'
import { Player } from './ultmt'

enum EventType {
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

interface Event {
    _id: Types.ObjectId
    pointId: Types.ObjectId
    eventNumber: number
    type: EventType
    displayMessage: string
    comments: string[]
    team: Types.ObjectId
    playerOne?: Player
    playerTwo?: Player
    tags: string[]
}

export default Event
