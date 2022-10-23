import { Types } from 'mongoose'
import { Player, Team } from './ultmt'
import { ClientAction } from './action'

export interface ClientPoint {
    pointNumber: number
    teamOnePlayers: Player[]
    teamOneScore: number
    teamTwoScore: number
    pullingTeam: Team
    receivingTeam: Team
    scoringTeam: Team
    actions: ClientAction[]
}

interface IPoint {
    _id: Types.ObjectId
    pointNumber: number
    teamOnePlayers: Player[]
    teamTwoPlayers: Player[]
    teamOneScore: number
    teamTwoScore: number
    pullingTeam: Team
    receivingTeam: Team
    scoringTeam?: Team
    teamOneActive: boolean
    teamTwoActive: boolean
    teamOneActions: Types.ObjectId[]
    teamTwoActions: Types.ObjectId[]
}

export default IPoint
