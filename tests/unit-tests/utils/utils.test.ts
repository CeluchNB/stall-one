import * as Constants from '../../../src/utils/constants'
import { getMyTeamNumber, getActionBaseKey, handleSocketError } from '../../../src/utils/utils'
import { TeamNumber } from '../../../src/types/ultmt'
import { ApiError } from '../../../src/types/errors'

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

describe('test get action base key', () => {
    it('gets correct base key', () => {
        expect(getActionBaseKey('1234', 5)).toBe('1234:5')
    })
})

describe('test handle socket error', () => {
    it('with object type', () => {
        const response = handleSocketError(new ApiError(Constants.INVALID_DATA, 400))
        expect(response.message).toBe(Constants.INVALID_DATA)
        expect(response.code).toBe(400)
    })

    it('with non-object type', () => {
        const response = handleSocketError(7)
        expect(response.message).toBe(Constants.GENERIC_ERROR)
        expect(response.code).toBe(500)
    })
})
