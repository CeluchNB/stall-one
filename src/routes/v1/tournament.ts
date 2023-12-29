import { Request, Response, Router } from 'express'
import { body, param, query } from 'express-validator'
import Tournament from '../../models/tournament'
import { errorMiddleware } from '../../middlware/errors'
import TournamentServices from '../../services/v1/tournament'
import { CreateTournament } from '../../types/tournament'

export const tournamentRouter = Router()

tournamentRouter.post(
    '/tournament',
    body('createTournamentData').isObject(),
    async (req: Request, res: Response, next) => {
        try {
            const services = new TournamentServices(
                Tournament,
                process.env.ULTMT_API_URL as string,
                process.env.API_KEY as string,
            )
            const jwt = req.headers?.authorization?.replace('Bearer ', '') as string
            const tournament = await services.createTournament(req.body.createTournamentData as CreateTournament, jwt)
            return res.status(201).json({ tournament })
        } catch (error) {
            next(error)
        }
    },
)

tournamentRouter.get('/tournament/search', query('q').escape(), async (req: Request, res: Response, next) => {
    try {
        const services = new TournamentServices(
            Tournament,
            process.env.ULTMT_API_URL as string,
            process.env.API_KEY as string,
        )
        const tournaments = await services.searchTournaments(req.query.q as string)
        return res.json({ tournaments })
    } catch (error) {
        next(error)
    }
})

tournamentRouter.get('/tournament/:id', param('id').isString(), async (req: Request, res: Response, next) => {
    try {
        const services = new TournamentServices(
            Tournament,
            process.env.ULTMT_API_URL as string,
            process.env.API_KEY as string,
        )
        const tournament = await services.getTournament(req.params.id)
        return res.json({ tournament })
    } catch (error) {
        next(error)
    }
})

tournamentRouter.use(errorMiddleware)
