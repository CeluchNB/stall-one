import { gameRouter } from './game'
import { pointRouter } from './point'
import { Router } from 'express'

export const router = Router()

router.use(gameRouter)
router.use(pointRouter)
