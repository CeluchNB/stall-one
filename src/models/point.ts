import { Schema, model, SchemaTypes } from 'mongoose'
import IPoint from '../types/point'

const schema = new Schema<IPoint>({
    pointNumber: Number,
    teamOnePlayers: [
        {
            _id: SchemaTypes.ObjectId,
            firstName: String,
            lastName: String,
            username: String,
        },
    ],
    teamTwoPlayers: [
        {
            _id: SchemaTypes.ObjectId,
            firstName: String,
            lastName: String,
            username: String,
        },
    ],
    teamOneScore: { type: Number, required: true },
    teamTwoScore: { type: Number, required: true },
    pullingTeam: {
        type: {
            _id: SchemaTypes.ObjectId,
            place: String,
            name: String,
            teamname: String,
            seasonStart: Date,
            seasonEnd: Date,
        },
        required: true,
    },
    receivingTeam: {
        type: {
            _id: SchemaTypes.ObjectId,
            place: String,
            name: String,
            teamname: String,
            seasonStart: Date,
            seasonEnd: Date,
        },
        required: true,
    },
    scoringTeam: {
        type: {
            _id: SchemaTypes.ObjectId,
            place: String,
            name: String,
            teamname: String,
            seasonStart: Date,
            seasonEnd: Date,
        },
    },
    actions: [SchemaTypes.ObjectId],
})

const Point = model<IPoint>('Point', schema)
export type IPointModel = typeof Point
export default Point
