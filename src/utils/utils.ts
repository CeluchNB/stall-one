import { Player, TeamNumber, TeamNumberString } from '../types/ultmt'
import { userErrorResponse } from '../middlware/errors'
import { Types } from 'mongoose'

export const getMyTeamNumber = (isMyTeam: boolean, myTeam: TeamNumberString): TeamNumber => {
    if (isMyTeam) {
        if (myTeam === 'one') {
            return TeamNumber.ONE
        } else {
            return TeamNumber.TWO
        }
    } else {
        if (myTeam === 'one') {
            return TeamNumber.TWO
        } else {
            return TeamNumber.ONE
        }
    }
}

export const getActionBaseKey = (pointId: string, number: number, team: TeamNumberString): string => {
    return `${pointId}:${number}:${team}`
}

export const handleSocketError = (error: unknown): { message: string; code: number } => {
    if (error && typeof error === 'object') {
        const errorData = userErrorResponse(error.toString())
        return errorData
    }
    const errorData = userErrorResponse('')
    return errorData
}

export const parseRedisUser = (redisUser: { [x: string]: string }): Player | undefined => {
    if (Object.keys(redisUser).length > 0) {
        const { id, firstName, lastName, username } = redisUser
        const player: Player = {
            firstName: firstName,
            lastName: lastName,
        }
        if (id) {
            player._id = new Types.ObjectId(id)
        }
        if (username) {
            player.username = username
        }

        return player
    }
    return undefined
}
