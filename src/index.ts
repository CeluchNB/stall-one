console.log('Very first thing', Date.now())
import dotenv from 'dotenv'

const pathToEnv = process.cwd() + '/src/config/.env'
dotenv.config({ path: pathToEnv })

import app from './app'

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
    console.log('Listening', Date.now())
    return console.log('Stall one listening on', PORT)
})
