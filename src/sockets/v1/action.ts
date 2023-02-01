import * as Constants from '../../utils/constants'
import { ClientAction, RedisAction, RedisClientType } from '../../types/action'
import { Server, Socket } from 'socket.io'
import ActionServices from '../../services/v1/action'
import { ApiError } from '../../types/errors'
import { handleSocketError } from '../../utils/utils'
import { gameAuth } from '../../middlware/socket-game-auth'
import { TeamNumberString } from '../../types/ultmt'

const actionHandler = async (
    data: ClientAction,
    gameId: string,
    pointId: string,
    teamNumber: TeamNumberString,
    client: RedisClientType,
): Promise<RedisAction> => {
    const services = new ActionServices(client, process.env.ULTMT_API_URL as string, process.env.API_KEY as string)
    return await services.createLiveAction(data, gameId, pointId, teamNumber)
}

const undoActionHandler = async (
    client: RedisClientType,
    data: {
        gameId: string
        pointId: string
        team: 'one' | 'two'
    },
): Promise<RedisAction | undefined> => {
    const { gameId, pointId, team } = data
    if (!gameId || !pointId || !team) {
        throw new ApiError(Constants.INVALID_DATA, 400)
    }
    const services = new ActionServices(client, process.env.ULTMT_API_URL as string, process.env.API_KEY as string)
    return await services.undoAction(gameId, pointId, team)
}

const serverActionHandler = async (
    client: RedisClientType,
    data: { pointId: string; actionNumber: number; teamNumber: TeamNumberString },
): Promise<RedisAction> => {
    const { pointId, actionNumber, teamNumber } = data
    if (!pointId || !actionNumber || !teamNumber) {
        throw new ApiError(Constants.INVALID_DATA, 400)
    }
    const services = new ActionServices(client, process.env.ULTMT_API_URL as string, process.env.API_KEY as string)
    return await services.getLiveAction(pointId, actionNumber, teamNumber)
}

const commentHandler = async (
    client: RedisClientType,
    data: { pointId: string; actionNumber: number; teamNumber: TeamNumberString; comment: string; jwt: string },
): Promise<RedisAction> => {
    const { pointId, actionNumber, teamNumber, comment, jwt } = data
    if (!pointId || !actionNumber || !teamNumber || !comment || !jwt) {
        throw new ApiError(Constants.INVALID_DATA, 400)
    }
    const services = new ActionServices(client, process.env.ULTMT_API_URL as string, process.env.API_KEY as string)
    return await services.addLiveComment(pointId, actionNumber, { comment, jwt }, teamNumber)
}

const deleteCommentHandler = async (
    client: RedisClientType,
    data: { pointId: string; actionNumber: number; teamNumber: TeamNumberString; commentNumber: number; jwt: string },
) => {
    const { pointId, actionNumber, teamNumber, commentNumber, jwt } = data
    if (!pointId || !actionNumber || !teamNumber || !commentNumber || !jwt) {
        throw new ApiError(Constants.INVALID_DATA, 400)
    }
    const services = new ActionServices(client, process.env.ULTMT_API_URL as string, process.env.API_KEY as string)
    return await services.deleteLiveComment(pointId, actionNumber, commentNumber, jwt, teamNumber)
}

const registerActionHandlers = (socket: Socket, client: RedisClientType, io: Server) => {
    const liveIo = io.of('/live')

    socket.on('join:point', (gameId: string, pointId: string) => {
        // can only join one point at a time
        for (const room of socket.rooms) {
            socket.leave(room)
        }
        socket.join(`${gameId}:${pointId}`)
    })

    socket.on('action', async (data) => {
        try {
            const { gameId, team } = await gameAuth(socket)
            const dataJson = JSON.parse(data)
            const { action: clientAction, pointId } = dataJson
            const action = await actionHandler(clientAction, gameId, pointId, team, client)
            // send action to client
            liveIo.to(`${gameId}:${pointId}`).emit('action:client', action)
            liveIo.to('servers').emit('action:server', { gameId, pointId, number: action.actionNumber })
        } catch (error) {
            handleSocketError(socket, error)
        }
    })

    socket.on('action:undo', async (data) => {
        try {
            const { gameId, team } = await gameAuth(socket)
            const dataJson = JSON.parse(data)
            const { pointId } = dataJson

            const action = await undoActionHandler(client, { gameId, team, pointId })
            if (action) {
                liveIo
                    .to(`${gameId}:${pointId}`)
                    .emit('action:undo:client', { pointId, actionNumber: action.actionNumber, team })
                liveIo
                    .to('servers')
                    .emit('action:undo:server', { gameId, pointId, actionNumber: action.actionNumber, team })
            } else {
                throw new ApiError(Constants.INVALID_DATA, 400)
            }
        } catch (error) {
            handleSocketError(socket, error)
        }
    })

    socket.on('action:server', async (data) => {
        try {
            const dataJson = JSON.parse(data)
            const { gameId, pointId } = dataJson
            const action = await serverActionHandler(client, dataJson)

            // send action to client
            liveIo.to(`${gameId}:${pointId}`).emit('action:client', action)
        } catch (error) {
            handleSocketError(socket, error)
        }
    })

    socket.on('action:undo:server', async (data) => {
        try {
            const dataJson = JSON.parse(data)
            const { gameId, pointId } = dataJson
            liveIo.to(`${gameId}:${pointId}`).emit('action:undo:client', dataJson)
        } catch (error) {
            handleSocketError(socket, error)
        }
    })

    socket.on('action:comment', async (data) => {
        try {
            const dataJson = JSON.parse(data)
            const { gameId, pointId, actionNumber, teamNumber } = dataJson
            const action = await commentHandler(client, dataJson)
            liveIo.to(`${gameId}:${pointId}`).emit('action:client', action)
            liveIo.to('servers').emit('action:server', { pointId, actionNumber, teamNumber })
        } catch (error) {
            handleSocketError(socket, error)
        }
    })

    socket.on('action:comment:delete', async (data) => {
        try {
            const dataJson = JSON.parse(data)
            const { gameId, pointId, actionNumber } = dataJson
            const action = await deleteCommentHandler(client, dataJson)
            liveIo.to(`${gameId}:${pointId}`).emit('action:client', action)
            liveIo.to('servers').emit('action:server', { gameId, pointId, actionNumber })
        } catch (error) {
            handleSocketError(socket, error)
        }
    })

    // next point event so viewer client can get the next point
    socket.on('point:next', async (data) => {
        try {
            const { gameId } = await gameAuth(socket)
            const { pointId } = JSON.parse(data)
            liveIo.to(`${gameId}:${pointId}`).emit('point:next:client')
            liveIo.to('servers').emit('point:next:server', { gameId, pointId })
        } catch (error) {
            handleSocketError(socket, error)
        }
    })

    socket.on('point:next:server', async (data) => {
        try {
            const { gameId, pointId } = JSON.parse(data)
            liveIo.to(`${gameId}:${pointId}`).emit('point:next:client')
        } catch (error) {
            handleSocketError(socket, error)
        }
    })
}

export default registerActionHandlers
