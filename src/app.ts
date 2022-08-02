import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/stall-one', async (req, res) => {
    res.json({ message: 'The games microservice for The Ultmt API' })
})

app.get('/stall-one/test', async (req, res) => {
    res.json({ message: 'This is a test message' })
})

export default app
