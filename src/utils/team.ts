import { TeamNumber } from '../types/ultmt'

export const isTeamOne = <T>(team: TeamNumber, value1: T, value2: T): T => {
    return team === TeamNumber.ONE ? value1 : value2
}
