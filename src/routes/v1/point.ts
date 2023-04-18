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

pointRouter.get(
    '/point/:id/actions',
    param('id').escape(),
    query('team').escape(),
    async (req: Request, res: Response, next) => {
        try {
            const redisClient = await getClient()
            const services = new PointServices(Point, Game, Action, redisClient)
            const actions = await services.getActionsByPoint(req.params.id, req.query.team as 'one' | 'two')
            return res.json({ actions })
        } catch (error) {
            next(error)
        }
    },
)

pointRouter.get(
    '/point/:id/live/actions',
    param('id').escape(),
    query('gameId').escape(),
    async (req: Request, res: Response) => {
        const redisClient = await getClient()
        const services = new PointServices(Point, Game, Action, redisClient)
        const actions = await services.getLiveActionsByPoint(req.query.gameId as string, req.params.id)
        return res.json({ actions })
    },
)

pointRouter.use(errorMiddleware)
