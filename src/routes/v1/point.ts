import { Request, Response, Router } from 'express'
import { body, param, query } from 'express-validator'
import passport from 'passport'
import { errorMiddleware } from '../../middlware/errors'
import Game from '../../models/game'
import Point from '../../models/point'
import PointServices from '../../services/v1/point'
import { GameAuth } from '../../types/game'
import { getMyTeamNumber } from '../../utils/utils'

export const pointRouter = Router()

pointRouter.post(
    '/point/first',
    query('pulling').isBoolean(),
    passport.authenticate('jwt', { session: false }),
    async (req: Request, res: Response, next) => {
        try {
            const data = req.user as GameAuth
            const pullingTeam = getMyTeamNumber(req.query.pulling === 'true', data.team)
            const services = new PointServices(Point, Game)
            const point = await services.createFirstPoint(data.game._id.toString(), pullingTeam)
            return res.json({ point })
        } catch (error) {
            next(error)
        }
    },
)

pointRouter.put(
    '/point/players/:id',
    body('players').isArray(),
    param('id').isString(),
    passport.authenticate('jwt', { session: false }),
    async (req: Request, res: Response, next) => {
        try {
            const data = req.user as GameAuth
            const teamNumber = getMyTeamNumber(true, data.team)
            const services = new PointServices(Point, Game)
            const point = await services.setPlayers(req.params.id, teamNumber, req.body.players)
            return res.json({ point })
        } catch (error) {
            next(error)
        }
    },
)

pointRouter.use(errorMiddleware)
