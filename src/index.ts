import { setupApp } from './app'

setupApp().then((app) => {
    const PORT = process.env.PORT || 3000

    app.listen(PORT, () => {
        return console.log('Stall one listening on', PORT)
    })
})
