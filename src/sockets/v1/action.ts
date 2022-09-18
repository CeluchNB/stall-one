import * as Constants from '../../utils/constants'
import IAction, { ClientAction, RedisClientType } from '../../types/action'
import { Socket } from 'socket.io'
import ActionServices from '../../services/v1/action'
import { ApiError } from '../../types/errors'
import { handleSocketError } from '../../utils/utils'
import { gameAuth } from '../../middlware/socket-game-auth'

const actionHandler = async (
    data: ClientAction,
    gameId: string,
    pointId: string,
    client: RedisClientType,
): Promise<IAction> => {
    const services = new ActionServices(client, process.env.ULTMT_API_URL as string, process.env.API_KEY as string)
    return await services.createLiveAction(data, gameId, pointId)
}

const undoActionHandler = async (
    client: RedisClientType,
    data: {
        gameId: string
        pointId: string
        team: 'one' | 'two'
    },
): Promise<IAction | undefined> => {
    const { gameId, pointId, team } = data
    if (!gameId || !pointId || !team) {
        throw new ApiError(Constants.INVALID_DATA, 400)
    }
    const services = new ActionServices(client, process.env.ULTMT_API_URL as string, process.env.API_KEY as string)
    return await services.undoAction(gameId, pointId, team)
}

const serverActionHandler = async (
    client: RedisClientType,
    data: { pointId: string; actionNumber: number },
): Promise<IAction> => {
    const { pointId, actionNumber } = data
    if (!pointId || !actionNumber) {
        throw new ApiError(Constants.INVALID_DATA, 400)
    }
    const services = new ActionServices(client, process.env.ULTMT_API_URL as string, process.env.API_KEY as string)
    return await services.getLiveAction(pointId, actionNumber)
}

const commentHandler = async (
    client: RedisClientType,
    data: { pointId: string; actionNumber: number; comment: string; jwt: string },
): Promise<IAction> => {
    const { pointId, actionNumber, comment, jwt } = data
    if (!pointId || !actionNumber || !comment || !jwt) {
        throw new ApiError(Constants.INVALID_DATA, 400)
    }
    const services = new ActionServices(client, process.env.ULTMT_API_URL as string, process.env.API_KEY as string)
    return await services.addLiveComment(pointId, actionNumber, { comment, jwt })
}

const deleteCommentHandler = async (
    client: RedisClientType,
    data: { pointId: string; actionNumber: number; commentNumber: number; jwt: string },
) => {
    const { pointId, actionNumber, commentNumber, jwt } = data
    if (!pointId || !actionNumber || !commentNumber || !jwt) {
        throw new ApiError(Constants.INVALID_DATA, 400)
    }
    const services = new ActionServices(client, process.env.ULTMT_API_URL as string, process.env.API_KEY as string)
    return await services.deleteLiveComment(pointId, actionNumber, commentNumber, jwt)
}

const registerActionHandlers = (socket: Socket, client: RedisClientType) => {
    socket.on('action', async (data) => {
        try {
            const { gameId } = await gameAuth(socket)
            const dataJson = JSON.parse(data)
            const { action: clientAction, pointId } = dataJson
            const action = await actionHandler(clientAction, gameId, pointId, client)
            // send action to client
            socket.emit('action:client', action)
            socket.to('servers').emit('action:server', { pointId, number: action.actionNumber })
        } catch (error) {
            const response = handleSocketError(error)
            socket.emit('action:error', response)
        }
    })

    socket.on('action:undo', async (data) => {
        try {
            const { gameId, team } = await gameAuth(socket)
            const dataJson = JSON.parse(data)
            const { pointId } = dataJson

            const action = await undoActionHandler(client, { gameId, team, pointId })
            if (action) {
                socket.emit('action:undo:client', { pointId, actionNumber: action.actionNumber })
                socket.emit('action:undo:server', { pointId, actionNumber: action.actionNumber })
            } else {
                throw new ApiError(Constants.INVALID_DATA, 400)
            }
        } catch (error) {
            const response = handleSocketError(error)
            socket.emit('action:error', response)
        }
    })

    socket.on('action:server', async (data) => {
        try {
            const dataJson = JSON.parse(data)
            const action = await serverActionHandler(client, dataJson)
            // send action to client
            socket.emit('action:client', action)
        } catch (error) {
            const response = handleSocketError(error)
            socket.emit('action:error', response)
        }
    })

    socket.on('action:undo:server', async (data) => {
        socket.emit('action:undo:client', data)
    })

    socket.on('action:comment', async (data) => {
        try {
            const dataJson = JSON.parse(data)
            const { pointId, actionNumber } = dataJson
            const action = await commentHandler(client, dataJson)
            socket.emit('action:client', action)
            socket.to('servers').emit('action:server', { pointId, actionNumber })
        } catch (error) {
            const response = handleSocketError(error)
            socket.emit('action:error', response)
        }
    })

    socket.on('action:comment:delete', async (data) => {
        try {
            const dataJson = JSON.parse(data)
            const { pointId, actionNumber } = dataJson
            const action = await deleteCommentHandler(client, dataJson)
            socket.emit('action:client', action)
            socket.to('servers').emit('action:server', { pointId, actionNumber })
        } catch (error) {
            const response = handleSocketError(error)
            socket.emit('action:error', response)
        }
    })
}

export default registerActionHandlers
