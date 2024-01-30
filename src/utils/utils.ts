import { Player, TeamNumber, TeamNumberString } from '../types/ultmt'
import { userErrorResponse } from '../middlware/errors'
import { Types } from 'mongoose'
import { UltmtLogger } from '../logging'

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

export const handleSocketError = (
    error: unknown,
    logger: UltmtLogger,
    inputData?: { gameId?: string; pointId?: string; team?: string },
    callback?: (...args: unknown[]) => void,
) => {
    let errorData
    if (error && typeof error === 'object') {
        errorData = userErrorResponse(error.toString())
    } else {
        errorData = userErrorResponse('')
    }

    logger.logError({ message: `socket error`, data: { errorData, ...inputData } })
    callback?.({ status: 'error', message: errorData.message })
}

export const parseRedisUser = (redisUser: { [x: string]: string }): Player | undefined => {
    if (Object.keys(redisUser).length > 0) {
        const { id, firstName, lastName, username } = redisUser
        const player: Player = {
            _id: new Types.ObjectId(id),
            firstName: firstName,
            lastName: lastName,
            username: username,
        }

        return player
    }
    return undefined
}
