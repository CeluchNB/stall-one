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
            const { gameId, team } = req.user as GameAuth
            const pullingTeam = getMyTeamNumber(req.query.pulling === 'true', team)
            const redisClient = await getClient()
            const services = new PointServices(Point, Game, Action, redisClient)
            const point = await services.createPoint(gameId, pullingTeam, Number(req.query.number))
            return res.json({ point })
        } catch (error) {
            next(error)
        }
    },
)

pointRouter.put(
    '/point/:id/pulling',
    param('id').isString(),
    query('team').isString(),
    passport.authenticate('jwt', { session: false }),
    async (req: Request, res: Response, next) => {
        try {
            const { gameId } = req.user as GameAuth
            if (req.query.team !== 'one' && req.query.team !== 'two') {
                throw new Error()
            }
            const teamNumber = getMyTeamNumber(true, req.query.team)
            const redisClient = await getClient()
            const services = new PointServices(Point, Game, Action, redisClient)
            const point = await services.setPullingTeam(gameId, req.params.id, teamNumber)
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
            const { gameId, team } = req.user as GameAuth
            const teamNumber = getMyTeamNumber(true, team)
            const redisClient = await getClient()
            const services = new PointServices(Point, Game, Action, redisClient)
            const point = await services.setPlayers(gameId, req.params.id, teamNumber, req.body.players)
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
            const { gameId, team } = req.user as GameAuth
            const teamNumber = getMyTeamNumber(true, team)
            const redisClient = await getClient()
            const services = new PointServices(Point, Game, Action, redisClient)
            const point = await services.finishPoint(gameId, req.params.id, teamNumber)
            return res.json({ point })
        } catch (error) {
            next(error)
        }
    },
)

pointRouter.put(
    '/point/:id/reactivate',
    param('id').isString(),
    passport.authenticate('jwt', { session: false }),
    async (req: Request, res: Response, next) => {
        try {
            const { gameId, team } = req.user as GameAuth
            const teamNumber = getMyTeamNumber(true, team)
            const redisClient = await getClient()
            const services = new PointServices(Point, Game, Action, redisClient)
            const point = await services.reactivatePoint(gameId, req.params.id, teamNumber)
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
            const { gameId, team } = req.user as GameAuth
            const teamNumber = getMyTeamNumber(true, team)
            const redisClient = await getClient()
            const services = new PointServices(Point, Game, Action, redisClient)
            await services.deletePoint(gameId, req.params.id, teamNumber)
            return res.send()
        } catch (error) {
            next(error)
        }
    },
)

pointRouter.get('/points', body('ids').isArray(), async (req: Request, res: Response, next) => {
    try {
        const ids = req.body.ids
        const redisClient = await getClient()
        const services = new PointServices(Point, Game, Action, redisClient)
        const points = await services.getPoints(ids)
        return res.json({ points })
    } catch (error) {
        next(error)
    }
})

pointRouter.use(errorMiddleware)
