console.log('Very first thing', Date.now())
import { setupApp } from './app'

setupApp().then((app) => {
    const PORT = process.env.PORT || 3000

    app.listen(PORT, () => {
        console.log('Listening', Date.now())
        return console.log('Stall one listening on', PORT)
    })
})
