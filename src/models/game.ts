import { Schema, SchemaTypes, model } from 'mongoose'
import IGame, { GameStatus } from '../types/game'
import jwt from 'jsonwebtoken'
import { TeamNumber } from '../types/ultmt'

const schema = new Schema<IGame>({
    teamOne: {
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
    teamTwo: {
        type: {
            _id: SchemaTypes.ObjectId,
            place: String,
            name: String,
            teamname: String,
            seasonStart: Date,
            seasonEnd: Date,
        },
        required: false,
    },
    teamTwoDefined: { type: Boolean, required: true, default: false },
    creator: {
        type: {
            _id: SchemaTypes.ObjectId,
            firstName: String,
            lastName: String,
            username: String,
        },
    },
    scoreLimit: { type: Number, default: 15 },
    halfScore: { type: Number, default: 8 },
    teamOneScore: { type: Number, default: 0 },
    teamTwoScore: { type: Number, default: 0 },
    startTime: Date,
    softcapMins: Number,
    hardcapMins: Number,
    teamOneActive: { type: Boolean, required: true, default: true },
    teamTwoActive: { type: Boolean, required: true, default: false },
    playersPerPoint: { type: Number, default: 7 },
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
    totalViews: Number,
    resolveCode: String,
    timeoutPerHalf: Number,
    floaterTimeout: Boolean,
    teamTwoJoined: Boolean,
    points: [SchemaTypes.ObjectId],
    tournament: {
        type: {
            _id: SchemaTypes.ObjectId,
            startDate: Date,
            endDate: Date,
            name: String,
            eventId: String,
        },
    },
    teamOneStatus: { type: String, enum: Object.values(GameStatus), default: GameStatus.ACTIVE },
    teamTwoStatus: { type: String, enum: Object.values(GameStatus), default: GameStatus.GUEST },
})

schema.methods.getToken = function (team: TeamNumber) {
    const token = jwt.sign({ team }, process.env.JWT_SECRET as string, {
        subject: this._id.toString(),
        expiresIn: '3 hours',
    })
    return token
}

schema.index({
    'teamOne.place': 'text',
    'teamOne.name': 'text',
    'teamOne.teamname': 'text',
    'teamTwo.place': 'text',
    'teamTwo.name': 'text',
    'teamTwo.teamname': 'text',
    'tournament.name': 'text',
    'tournament.eventId': 'text',
})

const Game = model<IGame>('Game', schema)
export type IGameModel = typeof Game
export default Game
