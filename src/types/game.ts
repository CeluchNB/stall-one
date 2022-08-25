import { Types } from 'mongoose'
import { Player, Team } from './ultmt'

export interface UpdateGame {
    teamTwo?: Team
    teamTwoDefined?: boolean
    scoreLimit?: number
    halfScore?: number
    startTime?: Date
    softcapMins?: number
    hardcapMins?: number
    liveGame?: boolean
    playersPerPoint?: number
    timeoutPerHalf?: number
    floaterTimeout?: boolean
}

type UpdateGameKey = keyof UpdateGame
export const updateGameKeys: UpdateGameKey[] = [
    'teamTwo',
    'teamTwoDefined',
    'scoreLimit',
    'halfScore',
    'startTime',
    'softcapMins',
    'hardcapMins',
    'liveGame',
    'playersPerPoint',
    'timeoutPerHalf',
    'floaterTimeout',
]

export interface CreateGame extends UpdateGame {
    creator: Player
    teamOne: Team
    teamTwo: Team
    teamTwoDefined: boolean
    scoreLimit: number
    halfScore: number
    startTime: Date
    softcapMins: number
    hardcapMins: number
    liveGame: boolean
    playersPerPoint: number
    timeoutPerHalf: number
    floaterTimeout: boolean
}

interface IGame extends CreateGame {
    _id: Types.ObjectId
    teamOneToken: string
    teamTwoToken?: string
    teamOneScore: number
    teamTwoScore: number
    teamTwoResolved: boolean
    completeGame: boolean
    teamOnePlayers: Player[]
    teamTwoPlayers: Player[]
    resolveCode: string
}

export default IGame
