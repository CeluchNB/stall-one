import express from 'express'
import cors from 'cors'
import passport from 'passport'
import { router as v1Router } from '../src/routes/v1'
import axios from 'axios'
import { createServer } from 'http'
import { Server } from 'socket.io'
import socketHandler, { client } from './sockets/v1'
import { connectDatabase, closeDatabase } from './loaders/mongoose'
import { createRedisAdapter, closeRedisConnection } from './loaders/redis'
import { ClientToServerEvents } from './types/socket'

connectDatabase()

const app = express()
app.use(cors())
app.use(express.json())
app.use(passport.initialize())
require('./loaders/passport')

app.use('/api/v1', v1Router)
app.get('/stall-one', async (req, res) => {
    const response = await axios.get(`${process.env.ULTMT_API_URL}/ultmt`, {
        headers: { 'x-api-key': process.env.API_KEY || '' },
    })
    const message = response.data
    res.json({ message: message.message })
})

const httpServer = createServer(app)
const io = new Server<ClientToServerEvents>(httpServer, {})

Promise.resolve(createRedisAdapter()).then((adapter) => {
    io.adapter(adapter)
    io.of('/live').on('connection', socketHandler)
})

// Close all connections, for testing purposes
export const close = async () => {
    if (client && client.isOpen) {
        await client.quit()
    }
    await closeDatabase()
    await closeRedisConnection()
}

export default httpServer
