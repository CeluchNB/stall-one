import Action from '../models/action'
import Game from '../models/game'
import Point from '../models/point'
import PointBackgroundServices from '@services/v1/point-background'
import { finishPoint, startPoint } from '../domains/point/next'
import { backPoint } from '../domains/point/back'
import { client } from '../utils/redis'
import { asClass, asFunction, asValue, createContainer, Lifetime } from 'awilix'
import PointServices from '@services/v2/point'
import { finishGame } from '../domains/game/finish'
import GameServices from '@services/v2/game'
import Tournament from '../models/tournament'

export const container = createContainer({ strict: true })

export const registerDependencies = () => {
    container.register({
        gameModel: asValue(Game),
        pointModel: asValue(Point),
        actionModel: asValue(Action),
        tournamentModel: asValue(Tournament),
        redisClient: asValue(client),
        ultmtUrl: asValue(process.env.ULTMT_API_URL),
        apiKey: asValue(process.env.API_KEY),
        finishPoint: asFunction(finishPoint, { lifetime: Lifetime.SINGLETON }),
        startPoint: asFunction(startPoint, { lifetime: Lifetime.SINGLETON }),
        backPoint: asFunction(backPoint, { lifetime: Lifetime.SINGLETON }),
        finishGame: asFunction(finishGame, { lifetime: Lifetime.SINGLETON }),
        pointBackgroundService: asClass(PointBackgroundServices, { lifetime: Lifetime.SINGLETON }),
        pointServiceV2: asClass(PointServices, { lifetime: Lifetime.SINGLETON }),
        gameServiceV2: asClass(GameServices, { lifetime: Lifetime.SINGLETON }),
    })
}
