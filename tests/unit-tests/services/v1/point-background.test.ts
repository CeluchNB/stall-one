import {
    setUpDatabase,
    tearDownDatabase,
    resetDatabase,
    client,
    createData,
    createPointData,
} from '../../../fixtures/setup-db'
import Point from '../../../../src/models/point'
import Game from '../../../../src/models/game'
import { TeamNumber } from '../../../../src/types/ultmt'
import { saveRedisAction } from '../../../../src/utils/redis'
import { ActionType, RedisAction } from '../../../../src/types/action'
import { getClient } from '../../../../src/utils/redis'
import { container, registerDependencies } from '../../../../src/di'

jest.mock('@google-cloud/tasks/build/src/v2')

beforeAll(async () => {
    registerDependencies()
    await setUpDatabase()
})

afterAll(async () => {
    await tearDownDatabase()
    const client = await getClient()
    await client.quit()
})

afterEach(async () => {
    await resetDatabase()
})

describe('handles finish point background service', () => {
    it('handles team one score', async () => {
        const services = container.resolve('pointBackgroundService')
        const game = await Game.create(createData)
        const point = await Point.create({ ...createPointData, teamTwoActive: false, teamOneActive: false })
        game.teamTwoActive = false
        game.teamTwoDefined = false
        game.points.push(point._id)
        await game.save()

        const firstAction: RedisAction = {
            actionNumber: 1,
            teamNumber: TeamNumber.ONE,
            actionType: ActionType.CATCH,
            tags: [],
            comments: [],
        }

        const secondAction: RedisAction = {
            actionNumber: 2,
            teamNumber: TeamNumber.ONE,
            actionType: ActionType.TEAM_ONE_SCORE,
            tags: [],
            comments: [],
        }

        await client.set(`${game._id.toString()}:${point._id.toString()}:pulling`, 'two')
        await client.set(`${game._id.toString()}:${point._id.toString()}:receiving`, 'one')
        await client.set(`${game._id.toString()}:${point._id.toString()}:one:actions`, 2)
        await client.set(`${game._id.toString()}:${point._id.toString()}:two:actions`, 0)
        await saveRedisAction(client, firstAction, point._id.toString())
        await saveRedisAction(client, secondAction, point._id.toString())
        await services.finishPoint(point._id.toHexString(), game._id.toHexString(), 'one')

        const pointRecord = await Point.findById(point._id)

        expect(pointRecord?.teamOneActions.length).toBe(2)
        expect(pointRecord?.teamTwoActions.length).toBe(0)

        const pullingKey = await client.get(`${game._id.toString()}:${point._id.toString()}:pulling`)
        expect(pullingKey).toBeNull()

        const receivingKey = await client.get(`${game._id.toString()}:${point._id.toString()}:receiving`)
        expect(receivingKey).toBeNull()

        const teamOneActionCount = await client.get(`${game._id.toString()}:${point._id.toString()}:one:actions`)
        expect(teamOneActionCount).toBeNull()

        const teamTwoActiveCount = await client.get(`${game._id.toString()}:${point._id.toString()}:two:actions`)
        expect(teamTwoActiveCount).toBeNull()
    })

    it('handles team two score', async () => {
        const services = container.resolve('pointBackgroundService')
        const game = await Game.create(createData)
        const point = await Point.create({ ...createPointData, teamTwoActive: false, teamOneActive: false })
        game.teamTwoActive = true
        game.teamTwoDefined = true
        game.points.push(point._id)
        await game.save()

        const firstAction: RedisAction = {
            actionNumber: 1,
            teamNumber: TeamNumber.TWO,
            actionType: ActionType.CATCH,
            tags: [],
            comments: [],
        }

        const secondAction: RedisAction = {
            actionNumber: 2,
            teamNumber: TeamNumber.TWO,
            actionType: ActionType.TEAM_ONE_SCORE,
            tags: [],
            comments: [],
        }

        await client.set(`${game._id.toString()}:${point._id.toString()}:pulling`, 'one')
        await client.set(`${game._id.toString()}:${point._id.toString()}:receiving`, 'two')
        await client.set(`${game._id.toString()}:${point._id.toString()}:one:actions`, 0)
        await client.set(`${game._id.toString()}:${point._id.toString()}:two:actions`, 2)
        await saveRedisAction(client, firstAction, point._id.toString())
        await saveRedisAction(client, secondAction, point._id.toString())
        await services.finishPoint(point._id.toHexString(), game._id.toHexString(), 'two')

        const pointRecord = await Point.findById(point._id)

        expect(pointRecord?.teamOneActions.length).toBe(0)
        expect(pointRecord?.teamTwoActions.length).toBe(2)

        const pullingKey = await client.get(`${game._id.toString()}:${point._id.toString()}:pulling`)
        expect(pullingKey).toBeNull()

        const receivingKey = await client.get(`${game._id.toString()}:${point._id.toString()}:receiving`)
        expect(receivingKey).toBeNull()

        const teamOneActionCount = await client.get(`${game._id.toString()}:${point._id.toString()}:one:actions`)
        expect(teamOneActionCount).toBe('0')

        const teamTwoActiveCount = await client.get(`${game._id.toString()}:${point._id.toString()}:two:actions`)
        expect(teamTwoActiveCount).toBeNull()
    })
})
