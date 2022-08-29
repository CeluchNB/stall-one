import { Types } from 'mongoose'
import { Player, Team } from './ultmt'

interface IPoint {
    _id: Types.ObjectId
    gameId: Types.ObjectId
    pointNumber: number
    teamOnePlayers: Player[]
    teamTwoPlayers: Player[]
    teamOneScore: number
    teamTwoScore: number
    pullingTeam: Team
    receivingTeam: Team
    scoringTeam?: Team
}

export default IPoint