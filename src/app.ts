import express from 'express'
import cors from 'cors'
import passport from 'passport'
import { router as v1Router } from '../src/routes/v1'
import { router as v2Router } from '../src/routes/v2'
import axios from 'axios'
import { createServer } from 'http'
import { Server } from 'socket.io'
import socketHandler from './sockets/v1'
import { connectDatabase, closeDatabase } from './loaders/mongoose'
import { createRedisAdapter, closeRedisConnection } from './loaders/redis'
import { ClientToServerEvents } from './types/socket'
import { getClient } from './utils/redis'

Promise.resolve(connectDatabase())

const app = express()
app.use(cors())
app.use(express.json())
app.use(passport.initialize())
require('./loaders/passport')

app.use('/api/v1', v1Router)
app.use('/api/v2', v2Router)

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

Promise.resolve(createRedisAdapter()).then(async (adapter) => {
    const client = await getClient()
    io.adapter(adapter)
    io.of('/live').on('connection', socketHandler(client, io))
})

// Close all connections, for testing purposes
export const close = async () => {
    const client = await getClient()
    if (client && client.isOpen) {
        await client.quit()
    }
    await closeDatabase()
    await closeRedisConnection()
}

export default httpServer
