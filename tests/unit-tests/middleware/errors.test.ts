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
    it('with invalid data case one', () => {
        expect(userErrorResponse(`Extra Error: ${Constants.INVALID_DATA}`)).toEqual({
            message: Constants.INVALID_DATA,
            code: 400,
        })
    })
    it('with invalid data case two', () => {
        expect(userErrorResponse('Extra Error: Invalid argument type')).toEqual({
            message: Constants.INVALID_DATA,
            code: 400,
        })
    })
    it('with profanity error', () => {
        expect(userErrorResponse(`Extra Error: ${Constants.PROFANE_COMMENT}`)).toEqual({
            message: Constants.PROFANE_COMMENT,
            code: 400,
        })
    })
    it('with score required error', () => {
        expect(userErrorResponse(`Extra Error: ${Constants.SCORE_REQUIRED}`)).toEqual({
            message: Constants.SCORE_REQUIRED,
            code: 400,
        })
    })
    it('with cannot delete point error', () => {
        expect(userErrorResponse(`Extra Error: ${Constants.MODIFY_LIVE_POINT_ERROR}`)).toEqual({
            message: Constants.MODIFY_LIVE_POINT_ERROR,
            code: 400,
        })
    })
    it('with invalid action type', () => {
        expect(userErrorResponse(`Extra Error: ${Constants.INVALID_ACTION_TYPE}`)).toEqual({
            message: Constants.INVALID_ACTION_TYPE,
            code: 400,
        })
    })
    it('with invalid conflicting score', () => {
        expect(userErrorResponse(`Extra Error: ${Constants.CONFLICTING_SCORE}`)).toEqual({
            message: Constants.CONFLICTING_SCORE,
            code: 400,
        })
    })
    it('with unfound tournament', () => {
        expect(userErrorResponse(`Extra Error: ${Constants.UNABLE_TO_FIND_TOURNAMENT}`)).toEqual({
            message: Constants.UNABLE_TO_FIND_TOURNAMENT,
            code: 404,
        })
    })
    it('with reactivate point error', () => {
        expect(userErrorResponse(`Extra Error: ${Constants.REACTIVATE_POINT_ERROR}`)).toEqual({
            message: Constants.REACTIVATE_POINT_ERROR,
            code: 400,
        })
    })
    it('with cannot go back point', () => {
        expect(userErrorResponse(`Extra Error: ${Constants.CANNOT_GO_BACK_POINT}`)).toEqual({
            message: Constants.CANNOT_GO_BACK_POINT,
            code: 400,
        })
    })
    it('with cannot create guest', () => {
        expect(userErrorResponse(`Extra Error: ${Constants.UNABLE_TO_CREATE_GUEST}`)).toEqual({
            message: Constants.UNABLE_TO_CREATE_GUEST,
            code: 400,
        })
    })
    it('with no previous point', () => {
        expect(userErrorResponse(`Extra Error: ${Constants.NO_PREVIOUS_POINT}`)).toEqual({
            message: Constants.NO_PREVIOUS_POINT,
            code: 400,
        })
    })
})
