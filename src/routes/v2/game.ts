import { Request, Response, Router } from 'express'
import { param, query } from 'express-validator'
import { container } from '../../di'
import passport from 'passport'

export const gameRouter = Router()

const services = container.resolve('gameServiceV2')

gameRouter.put(
    '/game/:id/reactivate',
    param('id').escape().isString(),
    query('team').escape().isString(),
    async (req: Request, res: Response, next) => {
        try {
            const jwt = req.headers?.authorization?.replace('Bearer ', '') as string
            const result = await services.reactivateGame(req.params.id, jwt, req.query.team as string)
            return res.json(result)
        } catch (e) {
            next(e)
        }
    },
)

gameRouter.put(
    '/game/finish',
    passport.authenticate('jwt', { session: false }),
    async (req: Request, res: Response, next) => {
        try {
            const game = await services.finish(req.user?.gameId, req.user?.team)
            return res.json({ game })
        } catch (e) {
            console.log('error', e)
            next(e)
        }
    },
)
