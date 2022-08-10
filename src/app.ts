import express from 'express'
import cors from 'cors'
import { router as v1Router } from '../src/routes/v1'

const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/v1', v1Router)

app.get('/stall-one', async (req, res) => {
    res.json({ message: 'The games microservice for The Ultmt API' })
})

export default app
