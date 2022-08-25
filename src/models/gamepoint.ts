import { Schema, model, SchemaTypes } from 'mongoose'
import IGamePoint from '../types/gamepoint'

const schema = new Schema<IGamePoint>({
    gameId: { type: SchemaTypes.ObjectId, ref: 'Game', required: true },
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
})

const GamePoint = model<IGamePoint>('GamePoint', schema)
export type IGamePointModel = typeof GamePoint
export default GamePoint
