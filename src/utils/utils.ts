import { TeamNumber } from '../types/ultmt'
import { userErrorResponse } from '../middlware/errors'

export const getMyTeamNumber = (isMyTeam: boolean, myTeam: 'one' | 'two'): TeamNumber => {
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

export const getActionBaseKey = (pointId: string, number: number): string => {
    return `${pointId}:${number}`
}

export const handleSocketError = (error: unknown): { message: string; code: number } => {
    if (error && typeof error === 'object') {
        const errorData = userErrorResponse(error.toString())
        return errorData
    }
    const errorData = userErrorResponse('')
    return errorData
}
