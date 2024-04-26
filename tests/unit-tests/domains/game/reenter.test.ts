import { Types } from 'mongoose'
import { container } from '../../../../src/di'
import Point from '../../../../src/models/point'
import Dependencies from '../../../../src/types/di'
import { PointStatus } from '../../../../src/types/point'
import { TeamNumber } from '../../../../src/types/ultmt'
import { client, saveRedisAction } from '../../../../src/utils/redis'
import { setUpDatabase, tearDownDatabase, resetDatabase, createPointData, gameData } from '../../../fixtures/setup-db'
import Game from '../../../../src/models/game'
import { ActionType } from '../../../../src/types/action'

jest.mock('@google-cloud/tasks/build/src/v2')

beforeAll(async () => {
    client.connect()
    await setUpDatabase()
})

beforeEach(async () => {
    await resetDatabase()
    jest.resetAllMocks()
})

afterAll(async () => {
    await tearDownDatabase()
    client.quit()
})

describe('Reenter Game', () => {
    let reenterGame: Dependencies['reenterGame']
    beforeAll(() => {
        reenterGame = container.resolve('reenterGame')
    })

    describe('perform', () => {
        it('works', () => {
            expect(1 + 1).toBe(2)
        })
    })

    describe('helpers', () => {
        let helpers: Dependencies['reenterGame']['helpers']
        beforeAll(() => {
            helpers = reenterGame.helpers
        })

        describe('getReentryPoint', () => {
            let getReentryPoint: Dependencies['reenterGame']['helpers']['getReentryPoint']
            beforeAll(() => {
                getReentryPoint = helpers.getReentryPoint
            })
            it('finds active point', async () => {
                const point = await Point.create({
                    ...createPointData,
                    pointNumber: 1,
                    teamOneStatus: PointStatus.ACTIVE,
                    teamTwoStatus: PointStatus.FUTURE,
                })
                await Point.create({
                    ...createPointData,
                    _id: new Types.ObjectId(),
                    pointNumber: 2,
                    teamOneStatus: PointStatus.COMPLETE,
                    teamTwoStatus: PointStatus.COMPLETE,
                })
                const result = await getReentryPoint(point.gameId, TeamNumber.ONE)
                expect(result?._id.toHexString()).toBe(point._id.toHexString())
            })

            it('finds complete point', async () => {
                await Point.create({
                    ...createPointData,
                    pointNumber: 1,
                    teamOneStatus: PointStatus.COMPLETE,
                    teamTwoStatus: PointStatus.FUTURE,
                })
                const point = await Point.create({
                    ...createPointData,
                    _id: new Types.ObjectId(),
                    pointNumber: 2,
                    teamOneStatus: PointStatus.COMPLETE,
                    teamTwoStatus: PointStatus.COMPLETE,
                })
                const result = await getReentryPoint(point.gameId, TeamNumber.ONE)
                expect(result?._id.toHexString()).toBe(point._id.toHexString())
            })

            it('throws with no point found', async () => {
                const result = await getReentryPoint(new Types.ObjectId(), TeamNumber.ONE)
                expect(result?._id.toHexString()).toBeUndefined()
            })
        })

        describe('getActivePoint', () => {
            let getActivePoint: Dependencies['reenterGame']['helpers']['getActivePoint']
            beforeAll(() => {
                getActivePoint = helpers.getActivePoint
            })

            it('successfully returns team one point', async () => {
                const point = await Point.create({
                    ...createPointData,
                    teamOneStatus: PointStatus.ACTIVE,
                    teamTwoStatus: PointStatus.FUTURE,
                })
                const result = await getActivePoint(point.gameId, TeamNumber.ONE)
                expect(result?._id.toHexString()).toBe(point._id.toHexString())
            })

            it('successfully returns team two point', async () => {
                const point = await Point.create({
                    ...createPointData,
                    teamOneStatus: PointStatus.COMPLETE,
                    teamTwoStatus: PointStatus.ACTIVE,
                })
                const result = await getActivePoint(point.gameId, TeamNumber.TWO)
                expect(result?._id.toHexString()).toBe(point._id.toHexString())
            })

            it('successfully returns undefined', async () => {
                const point = await Point.create({
                    ...createPointData,
                    teamOneStatus: PointStatus.COMPLETE,
                    teamTwoStatus: PointStatus.COMPLETE,
                })
                const result = await getActivePoint(point.gameId, TeamNumber.TWO)
                expect(result).toBeNull()
            })
        })

        describe('getLastCompletePoint', () => {
            let getLastCompletePoint: Dependencies['reenterGame']['helpers']['getLastCompletePoint']
            beforeAll(() => {
                getLastCompletePoint = reenterGame.helpers.getLastCompletePoint
            })

            it('gets last team one complete point', async () => {
                await Point.create({
                    ...createPointData,
                    pointNumber: 1,
                    teamOneStatus: PointStatus.COMPLETE,
                    teamTwoStatus: PointStatus.COMPLETE,
                })
                await Point.create({
                    ...createPointData,
                    _id: new Types.ObjectId(),
                    pointNumber: 2,
                    teamOneStatus: PointStatus.COMPLETE,
                    teamTwoStatus: PointStatus.COMPLETE,
                })
                const lastPoint = await Point.create({
                    ...createPointData,
                    _id: new Types.ObjectId(),
                    pointNumber: 3,
                    teamOneStatus: PointStatus.COMPLETE,
                    teamTwoStatus: PointStatus.COMPLETE,
                })
                const result = await getLastCompletePoint(lastPoint.gameId, TeamNumber.ONE)
                expect(result?._id.toHexString()).toBe(lastPoint._id.toHexString())
            })

            it('gets last team two complete point', async () => {
                await Point.create({
                    ...createPointData,
                    pointNumber: 1,
                    teamOneStatus: PointStatus.COMPLETE,
                    teamTwoStatus: PointStatus.COMPLETE,
                })
                await Point.create({
                    ...createPointData,
                    _id: new Types.ObjectId(),
                    pointNumber: 2,
                    teamOneStatus: PointStatus.COMPLETE,
                    teamTwoStatus: PointStatus.COMPLETE,
                })
                const lastPoint = await Point.create({
                    ...createPointData,
                    _id: new Types.ObjectId(),
                    pointNumber: 3,
                    teamOneStatus: PointStatus.COMPLETE,
                    teamTwoStatus: PointStatus.COMPLETE,
                })
                const result = await getLastCompletePoint(lastPoint.gameId, TeamNumber.TWO)
                expect(result?._id.toHexString()).toBe(lastPoint._id.toHexString())
            })

            it('gets null value', async () => {
                const lastPoint = await Point.create({
                    ...createPointData,
                    _id: new Types.ObjectId(),
                    pointNumber: 3,
                    teamOneStatus: PointStatus.COMPLETE,
                    teamTwoStatus: PointStatus.ACTIVE,
                })
                const result = await getLastCompletePoint(lastPoint.gameId, TeamNumber.TWO)
                expect(result).toBeNull()
            })
        })

        // describe('reactivateCompletePoint', () => {
        //     let reactivateCompletePoint: Dependencies['reenterGame']['helpers']['reactivateCompletePoint']
        //     beforeAll(() => {
        //         reactivateCompletePoint = reenterGame.helpers.reactivateCompletePoint
        //     })

        //     it('successfully reactivates point', async () => {

        //     })
        // })

        describe('initializeRedisData', () => {
            let initializeRedisData: Dependencies['reenterGame']['helpers']['initializeRedisData']
            beforeAll(() => {
                initializeRedisData = helpers.initializeRedisData
            })

            it('initializes team one', async () => {
                const game = await Game.create(gameData)
                const point = await Point.create({ ...createPointData, pullingTeam: gameData.teamOne })
                await initializeRedisData(game, point, TeamNumber.ONE, 5)

                const pullingTeam = await client.get(`${game._id.toHexString()}:${point._id.toHexString()}:pulling`)
                const receivingTeam = await client.get(`${game._id.toHexString()}:${point._id.toHexString()}:receiving`)
                const actions = await client.get(`${game._id.toHexString()}:${point._id.toHexString()}:one:actions`)
                expect(pullingTeam).toBe(TeamNumber.ONE)
                expect(receivingTeam).toBe(TeamNumber.TWO)
                expect(actions).toBe('5')
            })

            it('initializes team two', async () => {
                const game = await Game.create(gameData)
                const point = await Point.create({ ...createPointData, pullingTeam: gameData.teamTwo })
                await initializeRedisData(game, point, TeamNumber.TWO, 5)

                const pullingTeam = await client.get(`${game._id.toHexString()}:${point._id.toHexString()}:pulling`)
                const receivingTeam = await client.get(`${game._id.toHexString()}:${point._id.toHexString()}:receiving`)
                const actions = await client.get(`${game._id.toHexString()}:${point._id.toHexString()}:two:actions`)
                expect(pullingTeam).toBe(TeamNumber.TWO)
                expect(receivingTeam).toBe(TeamNumber.ONE)
                expect(actions).toBe('5')
            })
        })

        describe('getRedisActionsForPoint', () => {
            let getRedisActionsForPoint: Dependencies['reenterGame']['helpers']['getRedisActionsForPoint']
            beforeAll(() => {
                getRedisActionsForPoint = helpers.getRedisActionsForPoint
            })

            it('gets all actions', async () => {
                const gameId = 'game'
                const pointId = 'point'
                await client.set(`${gameId}:${pointId}:one:actions`, 2)
                await saveRedisAction(
                    client,
                    {
                        actionNumber: 1,
                        actionType: ActionType.PULL,
                        teamNumber: 'one',
                        tags: [],
                        comments: [],
                    },
                    pointId,
                )
                await saveRedisAction(
                    client,
                    {
                        actionNumber: 2,
                        actionType: ActionType.TEAM_TWO_SCORE,
                        teamNumber: 'one',
                        tags: [],
                        comments: [],
                    },
                    pointId,
                )

                const actions = await getRedisActionsForPoint(gameId, pointId, TeamNumber.ONE)
                expect(actions[0]).toMatchObject({ actionNumber: 1, actionType: ActionType.PULL })
                expect(actions[1]).toMatchObject({ actionNumber: 2, actionType: ActionType.TEAM_TWO_SCORE })
            })
        })
    })
})
