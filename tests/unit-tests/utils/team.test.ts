import { TeamNumber } from '../../../src/types/ultmt'
import { isTeamOne } from '../../../src/utils/team'

describe('isTeamOne', () => {
    it('returns team one case', () => {
        const result = isTeamOne(TeamNumber.ONE, { teamOne: 'one' }, { teamTwo: 'two' })
        expect(result).toMatchObject({ teamOne: 'one' })
    })

    it('returns team two case', () => {
        const result = isTeamOne(TeamNumber.TWO, { teamOne: 'one' }, { teamTwo: 'two' })
        expect(result).toMatchObject({ teamTwo: 'two' })
    })
})
