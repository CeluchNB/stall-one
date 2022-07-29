import dotenv from 'dotenv'
import { connectDatabase } from './loaders/mongoose'

const pathToEnv = process.cwd() + '/src/config/.env'
dotenv.config({ path: pathToEnv })

connectDatabase()

import app from './app'

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
    return console.log('Stall one listening on', PORT)
})
