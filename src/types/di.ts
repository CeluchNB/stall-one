import { IPointModel } from '../models/point'
import { IGameModel } from '../models/game'
import { IActionModel } from '../models/action'
import { RedisClientType } from './action'
import { FinishPoint } from '../domains/point/next/finish'

interface Dependencies {
    gameModel: IGameModel
    pointModel: IPointModel
    actionModel: IActionModel
    redisClient: RedisClientType
    ultmtUrl: string
    apiKey: string
    finishPoint: FinishPoint
}

export default Dependencies
