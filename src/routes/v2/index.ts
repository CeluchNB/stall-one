import { gameRouter } from './game'
import { Router } from 'express'

const router = Router()

router.use(gameRouter)

export default router
