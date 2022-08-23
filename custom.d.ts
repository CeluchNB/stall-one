import IGame from './src/types/game'

declare module 'express-serve-static-core' {
    interface Request {
        game?: IGame
    }
}
