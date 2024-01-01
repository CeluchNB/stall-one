import express from 'express'
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
import { finishPointQueue } from './background/v1'
import { createLazyRouter } from 'express-lazy-router'
import { loadPassportMiddleware } from './loaders/passport'
import dotenv from 'dotenv'

export const setupApp = async (): Promise<HttpServer> => {
    const pathToEnv = process.cwd() + '/src/config/.env'
    dotenv.config({ path: pathToEnv })

    const app = express()
    app.use(cors())
    app.use(express.json())
    app.use(passport.initialize())
    loadPassportMiddleware()
    finishPointQueue.initialize()

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

    const httpServer = createServer(app)
    httpServer.setTimeout(0)
    const io = new Server<ClientToServerEvents>(httpServer, {})

    await connectDatabase()
    const adapter = await createRedisAdapter()
    const client = await getClient()

    io.adapter(adapter)
    io.of('/live').on('connection', socketHandler(client, io))

    return httpServer
}

// Close all connections, for testing purposes
export const close = async () => {
    const client = await getClient()
    if (client && client.isOpen) {
        await client.quit()
    }
    await finishPointQueue.close()
    await closeDatabase()
    await closeRedisConnection()
}
