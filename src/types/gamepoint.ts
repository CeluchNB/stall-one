import { Types } from 'mongoose'
import { Player } from './ultmt'

interface IGamePoint {
    _id: Types.ObjectId
    gameId: Types.ObjectId
    pointNumber: number
    teamOnePlayers: Player[]
    teamTwoPlayers: Player[]
    teamOneScore: number
    teamTwoScore: number
    pullingTeam: Types.ObjectId
    receivingTeam: Types.ObjectId
    scoringTeam?: Types.ObjectId
}

export default IGamePoint
