import { gameRouter } from './game'
import { pointRouter } from './point'
import { tournamentRouter } from './tournament'
import { actionRouter } from './action'
import { Router } from 'express'

const router = Router()

router.use(gameRouter)
router.use(pointRouter)
router.use(tournamentRouter)
router.use(actionRouter)

export default router
