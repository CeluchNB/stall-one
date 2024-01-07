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
import { createLazyRouter } from 'express-lazy-router'
import { loadPassportMiddleware } from './loaders/passport'
import dotenv from 'dotenv'

export const setupApp = async (): Promise<HttpServer> => {
    console.log('setting up env', Date.now())
    const pathToEnv = process.cwd() + '/src/config/.env'
    dotenv.config({ path: pathToEnv })

    const app = express()
    app.use(cors())
    app.use(express.json())
    app.use(passport.initialize())
    console.log('loading passport middleware', Date.now())
    loadPassportMiddleware()

    console.log('setting up routers', Date.now())
    const lazyRouter = createLazyRouter()
    app.use(
        '/api/v1',
        lazyRouter(() => import('./routes/v1/index')),
    )
    app.use(
        '/api/v2',
        lazyRouter(() => import('./routes/v2')),
    )

    console.log('added routers', Date.now())
    app.get('/stall-one', async (req, res) => {
        const response = await axios.get(`${process.env.ULTMT_API_URL}/ultmt`, {
            headers: { 'x-api-key': process.env.API_KEY || '' },
        })
        const message = response.data
        res.json({ message: message.message })
    })

    console.log('creating server', Date.now())
    const httpServer = createServer(app)
    httpServer.setTimeout(0)
    const io = new Server<ClientToServerEvents>(httpServer, {})

    console.log('connecting database', Date.now())
    connectDatabase()
    console.log('creating redis adapter', Date.now())
    const adapter = await createRedisAdapter()
    console.log('done creating redis adapter', Date.now())
    const client = await getClient()

    io.adapter(adapter)
    io.of('/live').on('connection', socketHandler(client, io))

    console.log('returning server', Date.now())
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
