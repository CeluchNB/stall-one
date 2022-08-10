import * as Constants from '../utils/constants'
import { Schema, Types, model } from 'mongoose'
import IGame from '../types/game'
import jwt from 'jsonwebtoken'
import { ApiError } from '../types/errors'

const schema = new Schema<IGame>({
    teamOne: {
        type: {
            _id: Types.ObjectId,
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
            _id: Types.ObjectId,
            place: String,
            name: String,
            teamname: String,
            seasonStart: Date,
            seasonEnd: Date,
        },
        required: false,
    },
    teamTwoResolved: Boolean,
    creator: {
        type: {
            _id: Types.ObjectId,
            firstName: String,
            lastName: String,
            username: String,
        },
    },
    token: String,
    scoreLimit: { type: Number, default: 15 },
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
            _id: Types.ObjectId,
            firstName: String,
            lastName: String,
            username: String,
        },
    ],
    teamTwoPlayers: [
        {
            _id: Types.ObjectId,
            firstName: String,
            lastName: String,
            username: String,
        },
    ],
    joinOtp: [String],
    timeoutPerHalf: Number,
    floaterTimeout: Boolean,
})

schema.pre('save', async function (next) {
    if (!this.token) {
        const payload = {
            sub: this._id.toString(),
            iat: Date.now(),
        }

        try {
            const token = jwt.sign(payload, process.env.JWT_SECRET as string)
            this.token = token
        } catch (error) {
            throw new ApiError(Constants.GENERIC_ERROR, 500)
        }
    }

    next()
})

schema.methods.toJSON = function () {
    const gameObject = this.toObject()
    delete gameObject.token

    return gameObject
}

const Game = model<IGame>('Game', schema)
export type IGameModel = typeof Game
export default Game
