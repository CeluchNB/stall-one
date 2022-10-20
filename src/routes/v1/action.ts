import { Request, Response, Router } from 'express'
import { body, param } from 'express-validator'
import ActionServices from '../../services/v1/action'
import { errorMiddleware } from '../../middlware/errors'
import Action from '../../models/action'
import { getClient } from '../../utils/redis'

export const actionRouter = Router()

actionRouter.put(
    '/action/:id',
    param('id').escape(),
    body('players').isObject(),
    async (req: Request, res: Response, next) => {
        try {
            const userJwt = req.headers.authorization?.replace('Bearer ', '')
            const redisClient = await getClient()
            const services = new ActionServices(
                redisClient,
                process.env.ULTMT_API_URL || '',
                process.env.API_KEY || '',
                Action,
            )
            const { playerOne, playerTwo } = req.body.players
            const action = await services.editSavedAction(req.params.id, userJwt, playerOne, playerTwo)
            return res.status(200).json({ action })
        } catch (error) {
            next(error)
        }
    },
)

actionRouter.post(
    '/action/:id/comment',
    param('id').escape(),
    body('comment').isString(),
    async (req: Request, res: Response, next) => {
        try {
            const userJwt = req.headers.authorization?.replace('Bearer ', '') as string
            const redisClient = await getClient()
            const services = new ActionServices(
                redisClient,
                process.env.ULTMT_API_URL || '',
                process.env.API_KEY || '',
                Action,
            )
            const action = await services.addSavedComment(req.params.id, userJwt, req.body.comment)
            return res.status(201).json({ action })
        } catch (error) {
            next(error)
        }
    },
)

actionRouter.delete(
    '/action/:id/comment/:commentNumber',
    param('id').escape(),
    param('commentNumber').isString(),
    async (req: Request, res: Response, next) => {
        try {
            const userJwt = req.headers.authorization?.replace('Bearer ', '') as string
            const redisClient = await getClient()
            const services = new ActionServices(
                redisClient,
                process.env.ULTMT_API_URL || '',
                process.env.API_KEY || '',
                Action,
            )
            const action = await services.deleteSavedComment(req.params.id, userJwt, Number(req.params.commentNumber))
            return res.json({ action })
        } catch (error) {
            next(error)
        }
    },
)

actionRouter.get('/actions', body('ids').isArray(), async (req: Request, res: Response, next) => {
    try {
        const redisClient = await getClient()
        const services = new ActionServices(
            redisClient,
            process.env.ULTMT_API_URL || '',
            process.env.API_KEY || '',
            Action,
        )
        const { ids } = req.body
        const actions = await services.getActions(ids)
        return res.json({ actions })
    } catch (error) {
        next(error)
    }
})

actionRouter.use(errorMiddleware)
