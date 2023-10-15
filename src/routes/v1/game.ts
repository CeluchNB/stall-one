import { Request, Response, Router } from 'express'
import GameServices from '../../services/v1/game'
import { body, param, query } from 'express-validator'
import Game from '../../models/game'
import Point from '../../models/point'
import Action from '../../models/action'
import { errorMiddleware } from '../../middlware/errors'
import passport from 'passport'
import { GameAuth } from '../../types/game'
import { TeamNumber } from '../../types/ultmt'

export const gameRouter = Router()

gameRouter.post('/game', body('createGameData').isObject(), async (req: Request, res: Response, next) => {
    try {
        const jwt = req.headers.authorization?.replace('Bearer ', '')
        const data = req.body.createGameData
        const services = new GameServices(
            Game,
            Point,
            Action,
            process.env.ULTMT_API_URL || '',
            process.env.API_KEY || '',
        )
        const { game, token } = await services.createGame(data, jwt as string)
        return res.status(201).json({ game, token })
    } catch (error) {
        next(error)
    }
})

gameRouter.put(
    '/game',
    body('gameData').isObject(),
    passport.authenticate('jwt', { session: false }),
    async (req: Request, res: Response, next) => {
        try {
            const data = req.body.gameData
            const services = new GameServices(
                Game,
                Point,
                Action,
                process.env.ULTMT_API_URL || '',
                process.env.API_KEY || '',
            )
            const { gameId } = req.user as GameAuth
            const game = await services.updateGame(gameId, data)
            return res.json({ game })
        } catch (error) {
            next(error)
        }
    },
)

gameRouter.put(
    '/game/:id/resolve',
    param('id').escape().isString(),
    query('team').escape().isString(),
    query('otp').escape().isString(),
    async (req: Request, res: Response, next) => {
        try {
            const jwt = req.headers.authorization?.replace('Bearer ', '') as string
            const gameId = req.params.id
            const teamId = req.query.team as string
            const otp = req.query.otp as string
            const services = new GameServices(
                Game,
                Point,
                Action,
                process.env.ULTMT_API_URL || '',
                process.env.API_KEY || '',
            )
            const { game, token } = await services.teamTwoJoinGame(gameId, teamId, jwt, otp)
            return res.json({ game, token })
        } catch (error) {
            next(error)
        }
    },
)

gameRouter.put(
    '/game/player/guest',
    body('player').isObject(),
    passport.authenticate('jwt', { session: false }),
    async (req: Request, res: Response, next) => {
        try {
            const services = new GameServices(
                Game,
                Point,
                Action,
                process.env.ULTMT_API_URL || '',
                process.env.API_KEY || '',
            )
            const { gameId, team } = req.user as GameAuth
            const game = await services.addGuestPlayer(gameId, team as TeamNumber, req.body.player)
            return res.json({ game })
        } catch (error) {
            next(error)
        }
    },
)

gameRouter.put(
    '/game/finish',
    passport.authenticate('jwt', { session: false }),
    async (req: Request, res: Response, next) => {
        try {
            const services = new GameServices(
                Game,
                Point,
                Action,
                process.env.ULTMT_API_URL || '',
                process.env.API_KEY || '',
            )
            const { gameId, team } = req.user as GameAuth
            const game = await services.finishGame(gameId, team as TeamNumber)
            return res.json({ game })
        } catch (error) {
            next(error)
        }
    },
)

gameRouter.put(
    '/game/:id/reactivate',
    param('id').escape().isString(),
    query('team').escape().isString(),
    async (req: Request, res: Response, next) => {
        try {
            const jwt = req.headers?.authorization?.replace('Bearer ', '') as string
            const services = new GameServices(
                Game,
                Point,
                Action,
                process.env.ULTMT_API_URL || '',
                process.env.API_KEY || '',
            )
            const { game, token } = await services.reactivateGame(req.params.id, jwt, req.query.team as string)
            return res.json({ game, token })
        } catch (error) {
            next(error)
        }
    },
)

gameRouter.delete(
    '/game/:id',
    param('id').escape(),
    query('team').escape(),
    async (req: Request, res: Response, next) => {
        try {
            const jwt = req.headers?.authorization?.replace('Bearer ', '') as string
            const services = new GameServices(
                Game,
                Point,
                Action,
                process.env.ULTMT_API_URL || '',
                process.env.API_KEY || '',
            )
            await services.deleteGame(req.params.id, jwt, req.query.team as string)
            return res.json()
        } catch (error) {
            console.log('got error', error)
            next(error)
        }
    },
)

gameRouter.get('/game/search', async (req: Request, res: Response, next) => {
    try {
        const { q, live, after, before, pageSize, offset } = req.query
        const services = new GameServices(
            Game,
            Point,
            Action,
            process.env.ULTMT_API_URL || '',
            process.env.API_KEY || '',
        )

        const liveGame = live === undefined ? undefined : live === 'false' ? false : true
        const afterDate = after ? new Date(after as string) : undefined
        const beforeDate = before ? new Date(before as string) : undefined

        const games = await services.searchGames(
            q as string | undefined,
            liveGame,
            afterDate,
            beforeDate,
            pageSize ? Number(pageSize) : undefined,
            offset ? Number(offset) : undefined,
        )
        return res.json({ games })
    } catch (error) {
        next(error)
    }
})

gameRouter.get('/game/:id', param('id').escape(), async (req: Request, res: Response, next) => {
    try {
        const services = new GameServices(
            Game,
            Point,
            Action,
            process.env.ULTMT_API_URL || '',
            process.env.API_KEY || '',
        )
        const game = await services.getGame(req.params.id)
        return res.json({ game })
    } catch (error) {
        next(error)
    }
})

gameRouter.get('/game/:id/points', param('id').escape(), async (req: Request, res: Response, next) => {
    try {
        const services = new GameServices(
            Game,
            Point,
            Action,
            process.env.ULTMT_API_URL || '',
            process.env.API_KEY || '',
        )
        const points = await services.getPointsByGame(req.params.id)
        return res.json({ points })
    } catch (error) {
        next(error)
    }
})

gameRouter.post('/game/full', body('gameData').isObject(), async (req: Request, res: Response, next) => {
    try {
        const jwt = req.headers.authorization?.replace('Bearer ', '') as string
        const services = new GameServices(
            Game,
            Point,
            Action,
            process.env.ULTMT_API_URL || '',
            process.env.API_KEY || '',
        )
        const game = await services.createFullGame(req.body.gameData, jwt)
        return res.status(201).json({ game })
    } catch (error) {
        next(error)
    }
})

gameRouter.get('/game/team/:id', async (req: Request, res: Response, next) => {
    try {
        const services = new GameServices(
            Game,
            Point,
            Action,
            process.env.ULTMT_API_URL || '',
            process.env.API_KEY || '',
        )
        const games = await services.getGamesByTeamId(req.params.id)
        return res.json({ games })
    } catch (error) {
        next(error)
    }
})

gameRouter.use(errorMiddleware)
