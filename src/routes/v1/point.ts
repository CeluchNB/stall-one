import { Request, Response, Router } from 'express'
import { body, param, query } from 'express-validator'
import passport from 'passport'
import { errorMiddleware } from '../../middlware/errors'
import Game from '../../models/game'
import Point from '../../models/point'
import PointServices from '../../services/v1/point'
import { GameAuth } from '../../types/game'
import { getMyTeamNumber } from '../../utils/utils'
import { getClient } from '../../utils/redis'
import Action from '../../models/action'

export const pointRouter = Router()

pointRouter.post(
    '/point',
    query('pulling').isBoolean(),
    query('number').isNumeric(),
    passport.authenticate('jwt', { session: false }),
    async (req: Request, res: Response, next) => {
        try {
            const data = req.user as GameAuth
            const pullingTeam = getMyTeamNumber(req.query.pulling === 'true', data.team)
            const redisClient = await getClient()
            const services = new PointServices(Point, Game, Action, redisClient)
            const point = await services.createPoint(data.game._id.toString(), pullingTeam, Number(req.query.number))
            return res.json({ point })
        } catch (error) {
            next(error)
        }
    },
)

pointRouter.put(
    '/point/:id/players',
    body('players').isArray(),
    param('id').isString(),
    passport.authenticate('jwt', { session: false }),
    async (req: Request, res: Response, next) => {
        try {
            const data = req.user as GameAuth
            const teamNumber = getMyTeamNumber(true, data.team)
            const redisClient = await getClient()
            const services = new PointServices(Point, Game, Action, redisClient)
            const point = await services.setPlayers(
                data.game._id.toString(),
                req.params.id,
                teamNumber,
                req.body.players,
            )
            return res.json({ point })
        } catch (error) {
            next(error)
        }
    },
)

pointRouter.put(
    '/point/:id/finish',
    param('id').isString(),
    passport.authenticate('jwt', { session: false }),
    async (req: Request, res: Response, next) => {
        try {
            const data = req.user as GameAuth
            const teamNumber = getMyTeamNumber(true, data.team)
            const redisClient = await getClient()
            const services = new PointServices(Point, Game, Action, redisClient)
            const point = await services.finishPoint(data.game._id.toString(), req.params.id, teamNumber)
            return res.json({ point })
        } catch (error) {
            next(error)
        }
    },
)

pointRouter.delete(
    '/point/:id',
    param('id').isString(),
    passport.authenticate('jwt', { session: false }),
    async (req: Request, res: Response, next) => {
        try {
            const data = req.user as GameAuth
            const teamNumber = getMyTeamNumber(true, data.team)
            const redisClient = await getClient()
            const services = new PointServices(Point, Game, Action, redisClient)
            await services.deletePoint(data.game._id.toString(), req.params.id, teamNumber)
            return res.send()
        } catch (error) {
            next(error)
        }
    },
)

pointRouter.use(errorMiddleware)
