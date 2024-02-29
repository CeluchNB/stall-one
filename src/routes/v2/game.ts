import Action from '../../models/action'
import Game from '../../models/game'
import GameServices from '../../services/v2/game'
import Point from '../../models/point'
import { getClient } from '../../utils/redis'
import { Request, Response, Router } from 'express'
import { param, query } from 'express-validator'
import passport from 'passport'
import { GameAuth } from '../../types/game'
import { TeamNumber } from '../../types/ultmt'

export const gameRouter = Router()

gameRouter.put(
    '/game/:id/reactivate',
    param('id').escape().isString(),
    query('team').escape().isString(),
    async (req: Request, res: Response, next) => {
        try {
            const redisClient = await getClient()
            const jwt = req.headers?.authorization?.replace('Bearer ', '') as string
            const services = new GameServices(
                Game,
                Point,
                Action,
                redisClient,
                process.env.ULTMT_API_URL || '',
                process.env.API_KEY || '',
            )
            const result = await services.reactivateGame(req.params.id, jwt, req.query.team as string)
            return res.json(result)
        } catch (e) {
            next(e)
        }
    },
)

gameRouter.put(
    '/game/update-players',
    passport.authenticate('jwt', { session: false }),
    async (req: Request, res: Response, next) => {
        try {
            const redisClient = await getClient()
            const services = new GameServices(
                Game,
                Point,
                Action,
                redisClient,
                process.env.ULTMT_API_URL || '',
                process.env.API_KEY || '',
            )
            const { gameId, team } = req.user as GameAuth
            const game = await services.updateGamePlayers(gameId, team as TeamNumber)
            return res.json({ game })
        } catch (e) {
            next(e)
        }
    },
)
