import { Types } from 'mongoose'
import { Player, Team } from './ultmt'

export interface UpdateGame {
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
export interface CreateGame extends UpdateGame {
    teamOne: Team
}

interface IGame extends CreateGame {
    _id: Types.ObjectId
    creator: Player
    token: string
    teamOneScore: number
    teamTwoScore: number
    completeGame: boolean
    teamOnePlayers: Player[]
    teamTwoPlayers: Player[]
    resolveCode: string // ensure this cannot be set from post/put call, delete once used
}

export default IGame
