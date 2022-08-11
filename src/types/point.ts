import { Types } from 'mongoose'
import { Player } from './ultmt'

interface Point {
    _id: Types.ObjectId
    gameId: Types.ObjectId[]
    pointNumber: number
    teamOnePlayers: Player[]
    teamTwoPlayers?: Player[]
    events: Types.ObjectId[] // Need this? Just query events by pointId?
    teamOneScore: number
    teamTwoScore: number
}

export default Point
