import express, { ErrorRequestHandler, RequestHandler } from 'express'
import cors from 'cors'
import passport from 'passport'
import axios from 'axios'
import { createServer, Server as HttpServer } from 'http'
import { Server } from 'socket.io'
import socketHandler from './sockets/v1'
import { connectDatabase, closeDatabase } from './loaders/mongoose'
import { createRedisAdapter, closeRedisConnection } from './loaders/redis'
import { ClientToServerEvents } from './types/socket'
import { getClient } from './utils/redis'
import { createLazyRouter } from 'express-lazy-router'
import { loadPassportMiddleware } from './loaders/passport'
import dotenv from 'dotenv'
import { Logger } from './logging'
import { errorMiddleware } from './middlware/errors'
import { registerDependencies } from './di'

export const setupApp = async (): Promise<HttpServer> => {
    const pathToEnv = process.cwd() + '/src/config/.env'
    dotenv.config({ path: pathToEnv })
    registerDependencies()

    const logger = Logger()

    const app = express()
    app.use(express.json({ limit: '10mb' }))
    app.use(cors())
    app.use(logger.requestMiddleware as RequestHandler)
    app.use(passport.initialize())
    loadPassportMiddleware()

    const lazyRouter = createLazyRouter()
    app.use(
        '/api/v1',
        lazyRouter(() => import('./routes/v1/index')),
    )
    app.use(
        '/api/v2',
        lazyRouter(() => import('./routes/v2')),
    )

    app.get('/stall-one', async (req, res) => {
        const response = await axios.get(`${process.env.ULTMT_API_URL}/ultmt`, {
            headers: { 'x-api-key': process.env.API_KEY || '' },
        })
        const message = response.data
        res.json({ message: message.message })
    })

    app.use(logger.errorMiddleware as ErrorRequestHandler)
    app.use(errorMiddleware)

    const httpServer = createServer(app)
    httpServer.setTimeout(0)
    const io = new Server<ClientToServerEvents>(httpServer, {})

    await connectDatabase()
    const adapter = await createRedisAdapter()
    const client = await getClient()

    io.adapter(adapter)
    io.of('/live').on('connection', socketHandler(client, io, logger))

    return httpServer
}

// Close all connections, for testing purposes
export const close = async () => {
    const client = await getClient()
    if (client && client.isOpen) {
        await client.quit()
    }
    await closeDatabase()
    await closeRedisConnection()
}
