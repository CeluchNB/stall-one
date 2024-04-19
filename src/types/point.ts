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

export enum PointStatus {
    FUTURE = 'future',
    ACTIVE = 'active',
    COMPLETE = 'complete',
}

interface IPoint {
    _id: Types.ObjectId
    pointNumber: number
    teamOnePlayers: Player[]
    teamTwoPlayers: Player[]
    teamOneActivePlayers: Player[]
    teamTwoActivePlayers: Player[]
    teamOneScore: number
    teamTwoScore: number
    pullingTeam: Team
    receivingTeam: Team
    scoringTeam?: Team
    teamOneActive: boolean
    teamOneStatus: PointStatus
    teamTwoActive: boolean
    teamTwoStatus: PointStatus
    teamOneActions: Types.ObjectId[]
    teamTwoActions: Types.ObjectId[]
    gameId: Types.ObjectId
}

export default IPoint
