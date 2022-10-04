import { Schema, model } from 'mongoose'
import ITournament from '../types/tournament'

const schema = new Schema<ITournament>({
    name: {
        type: String,
        required: true,
    },
    startDate: Date,
    endDate: Date,
    eventId: { type: String, required: true, unique: true },
})

const Tournament = model<ITournament>('Tournament', schema)
export type ITournamentModel = typeof Tournament
export default Tournament
