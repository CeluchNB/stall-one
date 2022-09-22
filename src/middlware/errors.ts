import * as Constants from '../utils/constants'
import { ErrorRequestHandler } from 'express'

export const userErrorResponse = (error: string): { message: string; code: number } => {
    if (error.includes(Constants.UNAUTHENTICATED_USER)) {
        return { message: Constants.UNAUTHENTICATED_USER, code: 401 }
    } else if (error.includes(Constants.UNABLE_TO_FETCH_TEAM)) {
        return { message: Constants.UNABLE_TO_FETCH_TEAM, code: 404 }
    } else if (error.includes(Constants.WRONG_RESOLVE_CODE)) {
        return { message: Constants.WRONG_RESOLVE_CODE, code: 401 }
    } else if (error.includes(Constants.UNABLE_TO_FIND_GAME)) {
        return { message: Constants.UNABLE_TO_FIND_GAME, code: 404 }
    } else if (error.includes(Constants.UNABLE_TO_ADD_PLAYER)) {
        return { message: Constants.UNABLE_TO_ADD_PLAYER, code: 400 }
    } else if (error.includes(Constants.CONFLICTING_POSSESSION)) {
        return { message: Constants.CONFLICTING_POSSESSION, code: 400 }
    } else if (error.includes(Constants.UNABLE_TO_FIND_POINT)) {
        return { message: Constants.UNABLE_TO_FIND_POINT, code: 404 }
    } else if (error.includes(Constants.WRONG_NUMBER_OF_PLAYERS)) {
        return { message: Constants.WRONG_NUMBER_OF_PLAYERS, code: 400 }
    } else if (error.includes(Constants.INVALID_DATA) || error.includes('Invalid argument type')) {
        return { message: Constants.INVALID_DATA, code: 400 }
    } else if (error.includes(Constants.PROFANE_COMMENT)) {
        return { message: Constants.PROFANE_COMMENT, code: 400 }
    } else if (error.includes(Constants.SCORE_REQUIRED)) {
        return { message: Constants.SCORE_REQUIRED, code: 400 }
    } else if (error.includes(Constants.CANNOT_DELETE_POINT)) {
        return { message: Constants.CANNOT_DELETE_POINT, code: 400 }
    } else {
        return { message: Constants.GENERIC_ERROR, code: 500 }
    }
}

export const errorMiddleware: ErrorRequestHandler = (err, req, res, next) => {
    if (err) {
        const { message, code } = userErrorResponse(err.toString())
        res.status(code).json({ message })
    }
    next()
}
