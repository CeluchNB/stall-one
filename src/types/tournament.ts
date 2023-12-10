import { Types } from 'mongoose'
import { Player } from './ultmt'

export interface CreateTournament {
    startDate?: Date
    endDate?: Date
    name: string
    eventId: string
}

interface ITournament extends CreateTournament {
    _id: Types.ObjectId
    creator: Player
}

export default ITournament
