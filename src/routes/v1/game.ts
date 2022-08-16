import { Request, Response, Router } from 'express'
import GameServices from '../../services/v1/game'
import { body } from 'express-validator'
import Game from '../../models/game'
import { errorMiddleware } from '../../middlware/errors'
import passport from 'passport'
import IGame from '../../types/game'

export const gameRouter = Router()

gameRouter.post('/game', body('createGameData').isObject(), async (req: Request, res: Response, next) => {
    try {
        const jwt = req.headers.authorization?.replace('Bearer ', '')
        const data = req.body.createGameData
        const gameService = new GameServices(Game, process.env.ULTMT_API_URL || '', process.env.API_KEY || '')
        const { game, token } = await gameService.createGame(data, jwt as string)
        return res.status(201).json({ game, token })
    } catch (error) {
        next(error)
    }
})

gameRouter.put(
    '/game',
    body('gameData').isObject(),
    passport.authenticate('jwt', { session: false }),
    async (req: Request, res: Response, next) => {
        try {
            const data = req.body.gameData
            const gameService = new GameServices(Game, process.env.ULTMT_API_URL || '', process.env.API_KEY || '')
            const game = await gameService.updateGame((req.user as IGame)._id.toString(), data)
            return res.json({ game })
        } catch (error) {
            next(error)
        }
    },
)

gameRouter.use(errorMiddleware)
