import { Types } from 'mongoose'

export interface CreateTournament {
    startDate?: Date
    endDate?: Date
    name: string
    eventId: string
}

interface ITournament extends CreateTournament {
    _id: Types.ObjectId
}

export default ITournament
