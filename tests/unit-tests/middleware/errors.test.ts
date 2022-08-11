import * as Constants from '../../../src/utils/constants'
import { userErrorResponse } from '../../../src/middlware/errors'

describe('should return correct message for error', () => {
    it('with unauthenticated user', () => {
        expect(userErrorResponse(`Extra Error: ${Constants.UNAUTHENTICATED_USER}`)).toEqual({
            message: Constants.UNAUTHENTICATED_USER,
            code: 401,
        })
    })
    it('with unfound team', () => {
        expect(userErrorResponse(`Extra Error: ${Constants.UNABLE_TO_FETCH_TEAM}`)).toEqual({
            message: Constants.UNABLE_TO_FETCH_TEAM,
            code: 404,
        })
    })
    it('with generic error', () => {
        expect(userErrorResponse(`Extra Error: ${Constants.GENERIC_ERROR}`)).toEqual({
            message: Constants.GENERIC_ERROR,
            code: 500,
        })
    })
})
