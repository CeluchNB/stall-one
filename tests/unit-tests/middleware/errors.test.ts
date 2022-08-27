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
    it('with wrong resolve code', () => {
        expect(userErrorResponse(`Extra Error: ${Constants.WRONG_RESOLVE_CODE}`)).toEqual({
            message: Constants.WRONG_RESOLVE_CODE,
            code: 401,
        })
    })
    it('with unfound game', () => {
        expect(userErrorResponse(`Extra Error: ${Constants.UNABLE_TO_FIND_GAME}`)).toEqual({
            message: Constants.UNABLE_TO_FIND_GAME,
            code: 404,
        })
    })
    it('with unable to add player', () => {
        expect(userErrorResponse(`Extra Error: ${Constants.UNABLE_TO_ADD_PLAYER}`)).toEqual({
            message: Constants.UNABLE_TO_ADD_PLAYER,
            code: 400,
        })
    })
    it('with other team pulling', () => {
        expect(userErrorResponse(`Extra Error: ${Constants.UNABLE_TO_ADD_PLAYER}`)).toEqual({
            message: Constants.UNABLE_TO_ADD_PLAYER,
            code: 400,
        })
    })
    it('with other conflicting possession', () => {
        expect(userErrorResponse(`Extra Error: ${Constants.CONFLICTING_POSSESSION}`)).toEqual({
            message: Constants.CONFLICTING_POSSESSION,
            code: 400,
        })
    })
    it('with other conflicting possession', () => {
        expect(userErrorResponse(`Extra Error: ${Constants.UNABLE_TO_FIND_POINT}`)).toEqual({
            message: Constants.UNABLE_TO_FIND_POINT,
            code: 404,
        })
    })
    it('with other conflicting possession', () => {
        expect(userErrorResponse(`Extra Error: ${Constants.WRONG_NUMBER_OF_PLAYERS}`)).toEqual({
            message: Constants.WRONG_NUMBER_OF_PLAYERS,
            code: 400,
        })
    })
})
