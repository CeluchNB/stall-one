import { Schema, SchemaTypes, model } from 'mongoose'
import ITournament from '../types/tournament'

const schema = new Schema<ITournament>({
    name: {
        type: String,
        required: true,
    },
    startDate: Date,
    endDate: Date,
    eventId: { type: String, required: true, unique: true },
    creator: {
        _id: SchemaTypes.ObjectId,
        firstName: String,
        lastName: String,
        username: String,
    },
})

schema.index({ name: 'text', eventId: 'text' })

const Tournament = model<ITournament>('Tournament', schema)
export type ITournamentModel = typeof Tournament
export default Tournament
