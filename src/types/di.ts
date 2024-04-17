import { IPointModel } from '../models/point'
import { IGameModel } from '../models/game'
import { IActionModel } from '../models/action'
import { RedisClientType } from './action'
import { FinishPoint, StartPoint } from '../domains/point/next'
import { BackPoint } from '../domains/point/back'

interface Dependencies {
    gameModel: IGameModel
    pointModel: IPointModel
    actionModel: IActionModel
    redisClient: RedisClientType
    ultmtUrl: string
    apiKey: string
    finishPoint: FinishPoint
    startPoint: StartPoint
    backPoint: BackPoint
}

export default Dependencies
