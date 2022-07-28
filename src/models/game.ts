import { Schema, model } from 'mongoose'

const schema = new Schema<{ home: string; away: string }>({
    home: String,
    away: String,
})

const Game = model<{ home: string; away: string }>('Game', schema)
export default Game
