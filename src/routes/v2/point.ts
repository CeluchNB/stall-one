import passport from 'passport'
import { Request, Response, Router } from 'express'
import { container } from '../../di'

export const pointRouter = Router()

const services = container.resolve('pointServiceV2')

pointRouter.put(
    '/point/:id/next',
    passport.authenticate('jwt', { session: false }),
    async (req: Request, res: Response, next) => {
        try {
            const point = services.next(req.user?.gameId, req.user?.team)
            return res.json({ point })
        } catch (error) {
            next(error)
        }
    },
)
