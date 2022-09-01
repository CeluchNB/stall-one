import * as Constants from '../utils/constants'
import { Socket } from 'socket.io'
import jwt from 'jsonwebtoken'

export const gameAuth = (socket: Socket, next: (error?: Error) => void) => {
    const token = socket.request.headers.authorization?.replace('Bearer ', '')
    if (!token) {
        next(new Error(Constants.UNAUTHENTICATED_USER))
    }

    const payload = jwt.verify(token || '', process.env.JWT_SECRET || '')
    const gameId = payload.sub as string
    if (!gameId) {
        next(new Error(Constants.UNABLE_TO_FIND_GAME))
    }

    socket.data = { ...socket.data, gameId }
    next()
}
