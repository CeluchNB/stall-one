import express from 'express'
import cors from 'cors'
import Game from './models/game'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/', async (req, res) => {
    await Game.create({ home: 'Hazard', away: 'Bomb Squad' })
    res.json({ message: 'The games microservice for The Ultmt API' })
})

export default app
