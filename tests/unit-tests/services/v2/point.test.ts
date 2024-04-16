import * as Constants from '../../../../src/utils/constants'
import { container } from '../../../../src/di'
import Point from '../../../../src/models/point'
import { createPointData, gameData, resetDatabase, setUpDatabase, tearDownDatabase } from '../../../fixtures/setup-db'
import '../../../../src/services/v2/point'
import Game from '../../../../src/models/game'
import { TeamNumber } from '../../../../src/types/ultmt'
import { PointStatus } from '../../../../src/types/point'
import { client, saveRedisAction } from '../../../../src/utils/redis'
import { ActionType } from '../../../../src/types/action'
import { Types } from 'mongoose'

jest.mock('@google-cloud/tasks/build/src/v2')

beforeAll(async () => {
    await client.connect()
    await setUpDatabase()
})

beforeEach(async () => {
    await resetDatabase()
})

afterAll(async () => {
    client.quit()
    await tearDownDatabase()
})

describe('Point Services V2', () => {
    describe('next', () => {
        let next: any
        beforeAll(() => {
            next = container.resolve('pointServiceV2').next
        })
        it('starts first point', async () => {
            const game = await Game.create(gameData)
            const result = await next(game._id.toHexString(), TeamNumber.ONE, 0, TeamNumber.ONE)

            expect(result).toMatchObject({
                gameId: game._id,
                pointNumber: 1,
                teamOneStatus: PointStatus.ACTIVE,
                teamTwoStatus: PointStatus.FUTURE,
            })
            const keys = await client.keys('*')
            expect(keys.length).toBe(4)
        })

        it('errors when trying to create point too far in future', async () => {
            const game = await Game.create(gameData)
            await expect(next(game._id.toHexString(), TeamNumber.ONE, 1, TeamNumber.ONE)).rejects.toThrow(
                Constants.UNABLE_TO_FIND_POINT,
            )

            const keys = await client.keys('*')
            expect(keys.length).toBe(0)

            const points = await Point.find({})
            expect(points.length).toBe(0)
        })

        it('finishes and creates point', async () => {
            const game = await Game.create(gameData)
            const point = await Point.create({
                ...createPointData,
                teamOneStatus: PointStatus.ACTIVE,
                gameId: game._id,
                pointNumber: 1,
            })
            await client.set(`${game._id.toHexString()}:${point._id.toHexString()}:one:actions`, 1)
            await saveRedisAction(
                client,
                {
                    actionNumber: 1,
                    actionType: ActionType.TEAM_ONE_SCORE,
                    teamNumber: TeamNumber.ONE,
                    comments: [],
                    tags: [],
                },
                point._id.toHexString(),
            )

            const result = await next(game._id.toHexString(), TeamNumber.ONE, 1, TeamNumber.ONE)
            expect(result).toMatchObject({
                gameId: game._id,
                pointNumber: 2,
                teamOneStatus: PointStatus.ACTIVE,
                teamTwoStatus: PointStatus.FUTURE,
                teamOneScore: 1,
                teamTwoScore: 0,
            })

            const firstPoint = await Point.findOne({ pointNumber: 1 })
            expect(firstPoint).toMatchObject({
                teamOneScore: 1,
                teamOneStatus: PointStatus.COMPLETE,
            })

            const secondPoint = await Point.findOne({ pointNumber: 2 })
            expect(secondPoint).toMatchObject({
                teamOneScore: 1,
                teamTwoScore: 0,
                teamOneStatus: PointStatus.ACTIVE,
                teamTwoStatus: PointStatus.FUTURE,
            })
        })

        it('finishes point for team two', async () => {
            const game = await Game.create({ ...gameData, teamOneScore: 1 })
            const point = await Point.create({
                ...createPointData,
                teamOneStatus: PointStatus.COMPLETE,
                teamTwoStatus: PointStatus.ACTIVE,
                gameId: game._id,
                pointNumber: 1,
                teamOneScore: 1,
            })
            await client.set(`${game._id.toHexString()}:${point._id.toHexString()}:one:actions`, 1)
            await saveRedisAction(
                client,
                {
                    actionNumber: 1,
                    actionType: ActionType.TEAM_ONE_SCORE,
                    teamNumber: TeamNumber.TWO,
                    comments: [],
                    tags: [],
                },
                point._id.toHexString(),
            )
            await Point.create({
                ...createPointData,
                _id: new Types.ObjectId(),
                pointNumber: 2,
                gameId: game._id,
                teamOneStatus: PointStatus.ACTIVE,
                teamTwoStatus: PointStatus.FUTURE,
                teamOneScore: 1,
                teamTwoScore: 0,
            })

            const result = await next(game._id.toHexString(), TeamNumber.TWO, 1, TeamNumber.ONE)
            expect(result).toMatchObject({
                gameId: game._id,
                pointNumber: 2,
                teamOneStatus: PointStatus.ACTIVE,
                teamTwoStatus: PointStatus.ACTIVE,
                teamOneScore: 1,
                teamTwoScore: 0,
            })

            const points = await Point.find({})
            expect(points.length).toBe(2)

            const firstPoint = await Point.findOne({ pointNumber: 1 })
            expect(firstPoint).toMatchObject({
                teamOneScore: 1,
                teamOneStatus: PointStatus.COMPLETE,
            })

            const secondPoint = await Point.findOne({ pointNumber: 2 })
            expect(secondPoint).toMatchObject({
                teamOneScore: 1,
                teamTwoScore: 0,
                teamOneStatus: PointStatus.ACTIVE,
                teamTwoStatus: PointStatus.ACTIVE,
            })
        })
    })
})
