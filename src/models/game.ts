import * as Constants from '../utils/constants'
import { Schema, SchemaTypes, model } from 'mongoose'
import IGame from '../types/game'
import jwt from 'jsonwebtoken'
import { ApiError } from '../types/errors'

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
    teamTwoResolved: { type: Boolean, required: true, default: false },
    teamTwoDefined: { type: Boolean, required: true, default: false },
    creator: {
        type: {
            _id: SchemaTypes.ObjectId,
            firstName: String,
            lastName: String,
            username: String,
        },
    },
    teamOneToken: String,
    teamTwoToken: String,
    scoreLimit: { type: Number, default: 15 },
    halfScore: { type: Number, default: 8 },
    teamOneScore: { type: Number, default: 0 },
    teamTwoScore: { type: Number, default: 0 },
    startTime: Date,
    softcapMins: Number,
    hardcapMins: Number,
    liveGame: Boolean,
    completeGame: { type: Boolean, default: false },
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
    resolveCode: String,
    timeoutPerHalf: Number,
    floaterTimeout: Boolean,
    points: [SchemaTypes.ObjectId],
})

schema.pre('save', async function (next) {
    if (!this.teamOneToken) {
        const payload = {
            sub: this._id.toString(),
            team: 'one',
            iat: Date.now(),
        }

        try {
            const token = jwt.sign(payload, process.env.JWT_SECRET as string)
            this.teamOneToken = token
        } catch (error) {
            throw new ApiError(Constants.GENERIC_ERROR, 500)
        }
    }

    next()
})

schema.methods.toJSON = function () {
    const gameObject = this.toObject()
    delete gameObject.teamOneToken
    delete gameObject.teamTwoToken

    return gameObject
}

const Game = model<IGame>('Game', schema)
export type IGameModel = typeof Game
export default Game
