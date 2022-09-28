import * as Constants from '../utils/constants'
import { Socket } from 'socket.io'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { ApiError } from '../types/errors'

export const gameAuth = async (socket: Socket): Promise<{ gameId: string; team: 'one' | 'two' }> => {
    try {
        const token = socket.request.headers.authorization?.replace('Bearer ', '')
        if (!token) {
            throw new ApiError(Constants.UNAUTHENTICATED_USER, 401)
        }

        const payload = jwt.verify(token, process.env.JWT_SECRET as string)
        const gameId = payload.sub as string
        const team = (payload as JwtPayload).team
        if (!gameId || !team) {
            throw new Error()
        }

        return { gameId, team }
    } catch {
        throw new ApiError(Constants.UNAUTHENTICATED_USER, 401)
    }
}