import { gameRouter } from './game'
import { pointRouter } from './point'
import { Router } from 'express'

const router = Router()

router.use(gameRouter)
router.use(pointRouter)

export default router
