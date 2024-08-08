import Action from '../models/action'
import Game from '../models/game'
import Point from '../models/point'
import Tournament from '../models/tournament'
import { client } from '../utils/redis'
import GameServices from '../services/v2/game'
import PointBackgroundServices from '../services/v1/point-background'
import PointServices from '../services/v2/point'
import { backPoint } from '../domains/point/back'
import { finishGame } from '../domains/game/finish'
import { fullGame } from '../domains/game/full'
import { reenterGame } from '../domains/game/reenter'
import { finishPoint, startPoint } from '../domains/point/next'
import { asClass, asFunction, asValue, createContainer, Lifetime } from 'awilix'

export const container = createContainer({ strict: true })

export const registerDependencies = () => {
    container.register({
        actionModel: asValue(Action),
        gameModel: asValue(Game),
        pointModel: asValue(Point),
        tournamentModel: asValue(Tournament),
        redisClient: asValue(client),
        ultmtUrl: asValue(process.env.ULTMT_API_URL),
        apiKey: asValue(process.env.API_KEY),
        finishPoint: asFunction(finishPoint, { lifetime: Lifetime.SINGLETON }),
        startPoint: asFunction(startPoint, { lifetime: Lifetime.SINGLETON }),
        backPoint: asFunction(backPoint, { lifetime: Lifetime.SINGLETON }),
        finishGame: asFunction(finishGame, { lifetime: Lifetime.SINGLETON }),
        fullGame: asFunction(fullGame, { lifetime: Lifetime.SINGLETON }),
        reenterGame: asFunction(reenterGame, { lifetime: Lifetime.SINGLETON }),
        gameServiceV2: asClass(GameServices, { lifetime: Lifetime.SINGLETON }),
        pointBackgroundService: asClass(PointBackgroundServices, { lifetime: Lifetime.SINGLETON }),
        pointServiceV2: asClass(PointServices, { lifetime: Lifetime.SINGLETON }),
    })
}
