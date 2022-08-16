import express from 'express'
import cors from 'cors'
import passport from 'passport'
import { router as v1Router } from '../src/routes/v1'

const app = express()
app.use(cors())
app.use(express.json())

app.use(passport.initialize())
require('./loaders/passport')

app.use('/api/v1', v1Router)

app.get('/stall-one', async (req, res) => {
    const response = await fetch(`${process.env.ULTMT_API_URL}/ultmt`, {
        headers: { 'x-api-key': process.env.API_KEY || '' },
    })
    const message = await response.json()
    res.json({ message: message.message })
})

export default app
