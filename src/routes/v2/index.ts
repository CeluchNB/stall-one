import { gameRouter } from './game'
import { Router } from 'express'

export const router = Router()

router.use(gameRouter)
