import { Request, Response, Router } from 'express'
import { reconcileGuest } from '../../services/v1/reconcile-guest'
import { body } from 'express-validator'

export const reconcileGuestRouter = Router()

reconcileGuestRouter.put(
    '/reconcile-guest',
    body('teams').isArray(),
    body('guestId').escape(),
    body('user').isObject(),
    async (req: Request, res: Response, next) => {
        try {
            const { teams, guestId, user } = req.body
            await reconcileGuest(teams, guestId, user)
            return res.send()
        } catch (e) {
            next(e)
        }
    },
)
