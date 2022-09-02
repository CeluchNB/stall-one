import { TeamNumber } from '../types/ultmt'

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
