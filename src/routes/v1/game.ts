import { Request, Response, Router } from 'express'
import GameServices from '../../services/v1/game'
import { body, param, query } from 'express-validator'
import Game from '../../models/game'
import { errorMiddleware } from '../../middlware/errors'
import passport from 'passport'
import IGame from '../../types/game'
import { TeamNumber } from '../../types/ultmt'

export const gameRouter = Router()

gameRouter.post('/game', body('createGameData').isObject(), async (req: Request, res: Response, next) => {
    try {
        const jwt = req.headers.authorization?.replace('Bearer ', '')
        const data = req.body.createGameData
        const services = new GameServices(Game, process.env.ULTMT_API_URL || '', process.env.API_KEY || '')
        const { game, token } = await services.createGame(data, jwt as string)
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
            const services = new GameServices(Game, process.env.ULTMT_API_URL || '', process.env.API_KEY || '')
            const game = await services.updateGame(
                (req.user as { game: IGame; team: string }).game._id.toString(),
                data,
            )
            return res.json({ game })
        } catch (error) {
            next(error)
        }
    },
)

gameRouter.put(
    '/game/resolve/:id',
    param('id').isString(),
    query('team').isString(),
    query('otp').isString(),
    async (req: Request, res: Response, next) => {
        try {
            const jwt = req.headers.authorization?.replace('Bearer ', '') as string
            const gameId = req.params.id
            const teamId = req.query.team as string
            const otp = req.query.otp as string
            const services = new GameServices(Game, process.env.ULTMT_API_URL || '', process.env.API_KEY || '')
            const { game, token } = await services.teamTwoJoinGame(gameId, teamId, jwt, otp)
            return res.json({ game, token })
        } catch (error) {
            next(error)
        }
    },
)

gameRouter.put(
    '/game/player/guest',
    body('player').isObject(),
    passport.authenticate('jwt', { session: false }),
    async (req: Request, res: Response, next) => {
        try {
            const services = new GameServices(Game, process.env.ULTMT_API_URL || '', process.env.API_KEY || '')
            const { game: gameLogin, team } = req.user as { game: IGame; team: string }
            const game = await services.addGuestPlayer(gameLogin._id.toString(), team as TeamNumber, req.body.player)
            return res.json({ game })
        } catch (error) {
            next(error)
        }
    },
)

gameRouter.use(errorMiddleware)
