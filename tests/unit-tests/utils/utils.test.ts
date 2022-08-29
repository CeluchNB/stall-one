import { getMyTeamNumber } from '../../../src/utils/utils'
import { TeamNumber } from '../../../src/types/ultmt'

describe('test get my team number', () => {
    it('case 1', () => {
        const number = getMyTeamNumber(true, 'one')
        expect(number).toBe(TeamNumber.ONE)
    })

    it('case 2', () => {
        const number = getMyTeamNumber(true, 'two')
        expect(number).toBe(TeamNumber.TWO)
    })

    it('case 3', () => {
        const number = getMyTeamNumber(false, 'one')
        expect(number).toBe(TeamNumber.TWO)
    })

    it('case 4', () => {
        const number = getMyTeamNumber(false, 'two')
        expect(number).toBe(TeamNumber.ONE)
    })
})