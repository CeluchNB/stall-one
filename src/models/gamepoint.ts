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
    pullingTeam: { type: SchemaTypes.ObjectId, required: true },
    receivingTeam: { type: SchemaTypes.ObjectId, required: true },
    scoringTeam: { type: SchemaTypes.ObjectId },
})

const GamePoint = model<IGamePoint>('GamePoint', schema)
export type IGamePointModel = typeof GamePoint
export default GamePoint
