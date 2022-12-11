import * as Constants from '../utils/constants'
import { Socket } from 'socket.io'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { ApiError } from '../types/errors'
import { GameAuth } from '../types/game'

export const gameAuth = async (socket: Socket): Promise<GameAuth> => {
    try {
        const token = socket.request.headers.authorization?.replace('Bearer ', '')
        if (!token) {
            throw new ApiError(Constants.UNAUTHENTICATED_USER, 401)
        }

        const payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload
        const gameId = payload.sub as string
        const team = (payload as JwtPayload).team
        if (!gameId || !team) {
            throw new ApiError(Constants.UNAUTHENTICATED_USER, 401)
        }

        return { gameId, team }
    } catch {
        throw new ApiError(Constants.UNAUTHENTICATED_USER, 401)
    }
}
