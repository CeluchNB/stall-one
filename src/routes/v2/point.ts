import passport from 'passport'
import { Request, Response, Router } from 'express'
import { container } from '../../di'
import { query } from 'express-validator'

export const pointRouter = Router()

const services = container.resolve('pointServiceV2')

pointRouter.post(
    '/point/next',
    query('pointNumber').escape(),
    query('pullingTeam').escape(),
    passport.authenticate('jwt', { session: false }),
    async (req: Request, res: Response, next) => {
        try {
            const { pointNumber, pullingTeam } = req.query

            const point = await services.next(req.user?.gameId, req.user?.team, pointNumber, pullingTeam)
            return res.status(201).json({ point })
        } catch (error) {
            next(error)
        }
    },
)
