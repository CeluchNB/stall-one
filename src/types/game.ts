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
    playersPerPoint?: number
    timeoutPerHalf?: number
    floaterTimeout?: boolean
    tournament?: Types.ObjectId
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
    playersPerPoint: number
    timeoutPerHalf: number
    floaterTimeout: boolean
    tournament?: Types.ObjectId
}

interface IGame extends CreateGame {
    _id: Types.ObjectId
    teamOneToken: string
    teamTwoToken?: string
    teamOneScore: number
    teamTwoScore: number
    teamOneActive: boolean
    teamTwoActive: boolean
    teamOnePlayers: Player[]
    teamTwoPlayers: Player[]
    resolveCode: string
    points: Types.ObjectId[]
}

export interface GameAuth {
    team: 'one' | 'two'
    game: IGame
}

export default IGame
