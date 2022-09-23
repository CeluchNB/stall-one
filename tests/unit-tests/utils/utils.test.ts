import * as Constants from '../../../src/utils/constants'
import { getMyTeamNumber, getActionBaseKey, handleSocketError, parseRedisUser } from '../../../src/utils/utils'
import { TeamNumber } from '../../../src/types/ultmt'
import { ApiError } from '../../../src/types/errors'
import { Types } from 'mongoose'

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

describe('test parse redis user', () => {
    it('with all data', () => {
        const userData = {
            id: '123456adecbd123456edcfa9',
            firstName: 'Noah',
            lastName: 'Celuch',
            username: 'noah',
        }
        const user = parseRedisUser(userData)

        expect(user).toMatchObject({
            _id: new Types.ObjectId(userData.id),
            firstName: userData.firstName,
            lastName: userData.lastName,
            username: user?.username,
        })
    })

    it('with minimal data', () => {
        const userData = {
            firstName: 'Noah',
            lastName: 'Celuch',
        }
        const user = parseRedisUser(userData)

        expect(user).toMatchObject({
            firstName: userData.firstName,
            lastName: userData.lastName,
        })
    })

    it('with no data', () => {
        const user = parseRedisUser({})

        expect(user).toBeUndefined()
    })
})
