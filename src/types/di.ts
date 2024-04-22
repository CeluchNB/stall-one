import { IPointModel } from '../models/point'
import { IGameModel } from '../models/game'
import { IActionModel } from '../models/action'
import { RedisClientType } from './action'
import { FinishPoint, StartPoint } from '../domains/point/next'
import { BackPoint } from '../domains/point/back'
import { FinishGame } from '../domains/game/finish'
import { ITournamentModel } from '../models/tournament'
import { FullGame } from '../domains/game/full'

interface Dependencies {
    gameModel: IGameModel
    pointModel: IPointModel
    actionModel: IActionModel
    tournamentModel: ITournamentModel
    redisClient: RedisClientType
    ultmtUrl: string
    apiKey: string
    finishPoint: FinishPoint
    startPoint: StartPoint
    backPoint: BackPoint
    finishGame: FinishGame
    fullGame: FullGame
}

export default Dependencies
