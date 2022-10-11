import { Types } from 'mongoose'
import ITournament from './tournament'
import { Player, Team } from './ultmt'

export interface UpdateGame {
    teamTwo?: Team
    teamTwoDefined?: boolean
    scoreLimit?: number
    halfScore?: number
    startTime?: Date
    softcapMins?: number
    hardcapMins?: number
    playersPerPoint?: number
    timeoutPerHalf?: number
    floaterTimeout?: boolean
    tournament?: ITournament
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
    'playersPerPoint',
    'timeoutPerHalf',
    'floaterTimeout',
]

export interface CreateGame {
    creator: Player
    teamOne: Team
    teamTwo: Team
    teamTwoDefined: boolean
    scoreLimit: number
    halfScore: number
    startTime: Date
    softcapMins: number
    hardcapMins: number
    playersPerPoint: number
    timeoutPerHalf: number
    floaterTimeout: boolean
    tournament?: ITournament
}

interface IGame extends CreateGame {
    _id: Types.ObjectId
    teamOneScore: number
    teamTwoScore: number
    teamOneActive: boolean
    teamTwoActive: boolean
    teamOnePlayers: Player[]
    teamTwoPlayers: Player[]
    resolveCode: string
    points: Types.ObjectId[]
    getToken: (team: 'one' | 'two') => string
}

export interface GameAuth {
    team: 'one' | 'two'
    gameId: string
}

export default IGame
