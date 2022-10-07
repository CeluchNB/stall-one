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
            const services = new TournamentServices(Tournament)
            const tournament = await services.createTournament(req.body.createTournamentData as CreateTournament)
            return res.status(201).json({ tournament })
        } catch (error) {
            next(error)
        }
    },
)

tournamentRouter.get('/tournament/search', query('q').escape(), async (req: Request, res: Response, next) => {
    try {
        const services = new TournamentServices(Tournament)
        const tournaments = await services.searchTournaments(req.query.q as string)
        return res.json({ tournaments })
    } catch (error) {
        next(error)
    }
})

tournamentRouter.get('/tournament/:id', param('id').isString(), async (req: Request, res: Response, next) => {
    try {
        const services = new TournamentServices(Tournament)
        const tournament = await services.getTournament(req.params.id)
        return res.json({ tournament })
    } catch (error) {
        next(error)
    }
})

tournamentRouter.use(errorMiddleware)
