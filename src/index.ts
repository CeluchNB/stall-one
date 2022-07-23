import dotenv from 'dotenv'

const pathToEnv = process.cwd() + '/src/config/.env'
dotenv.config({ path: pathToEnv })

import app from './app'

const PORT = process.env.PORT || 4000

app.listen(PORT, () => {
    return console.log('app listening on', PORT)
})
