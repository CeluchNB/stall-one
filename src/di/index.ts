import Action from '../models/action'
import Game from '../models/game'
import Point from '../models/point'
import PointBackgroundServices from '@services/v1/point-background'
import PointServicesV2 from '@services/v2/point'
import { client } from 'utils/redis'
import { asClass, asValue, createContainer, Lifetime } from 'awilix'

export const container = createContainer({ strict: true })

export const registerDependencies = () => {
    container.register({
        gameModel: asValue(Game),
        pointModel: asValue(Point),
        actionModel: asValue(Action),
        redisClient: asValue(client),
        ultmtUrl: asValue(process.env.ULTMT_API_URL),
        apiKey: asValue(process.env.API_KEY),
        pointBackgroundService: asClass(PointBackgroundServices, { lifetime: Lifetime.SINGLETON }),
        pointServiceV2: asClass(PointServicesV2, { lifetime: Lifetime.SINGLETON }),
    })
}
