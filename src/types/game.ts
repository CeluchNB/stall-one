import { Document } from 'mongoose'
import { Player, Team } from './ultmt'

export interface CreateGame {
    teamOne: Team
    teamTwo: Team
    teamTwoResolved: boolean
    scoreLimit: number
    startTime: Date
    softcapMins: number
    hardcapMins: number
    liveGame: boolean
    playersPerPoint: number
    timeoutPerHalf: number
    floaterTimeout: boolean
}

interface IGame extends Document {
    teamOne: Team
    teamTwo: Team
    teamTwoResolved: boolean
    creator: Player
    token: string
    scoreLimit: number
    teamOneScore: number
    teamTwoScore: number
    startTime: Date
    softcapMins: number
    hardcapMins: number
    liveGame: boolean
    completeGame: boolean
    playersPerPoint: number
    teamOnePlayers: Player[]
    teamTwoPlayers: Player[]
    joinOtp: string[] // ensure this cannot be set from post/put call, delete once used
    timeoutPerHalf: number
    floaterTimeout: boolean
}

export default IGame
