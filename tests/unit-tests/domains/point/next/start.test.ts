import {
    setUpDatabase,
    resetDatabase,
    tearDownDatabase,
    gameData,
    createPointData,
} from '../../../../fixtures/setup-db'
import { client } from '../../../../../src/utils/redis'
import IGame from '../../../../../src/types/game'
import Game from '../../../../../src/models/game'
import { container } from '../../../../../src/di'
import Dependencies from '../../../../../src/types/di'
import { TeamNumber } from '../../../../../src/types/ultmt'
import Point from '../../../../../src/models/point'
import { PointStatus } from '../../../../../src/types/point'
import { Types } from 'mongoose'

beforeAll(async () => {
    client.connect()
    await setUpDatabase()
})

beforeEach(async () => {
    await resetDatabase()
})

afterAll(async () => {
    await tearDownDatabase()
    client.quit()
})

describe('Start Point', () => {
    let startPoint: Dependencies['startPoint']
    beforeAll(() => {
        startPoint = container.resolve('startPoint')
    })
    describe('perform', () => {
        it('creates points', async () => {
            const game = await Game.create(gameData)
            const result = await startPoint.perform(game._id.toHexString(), TeamNumber.ONE, 2, TeamNumber.ONE)
            expect(result).toMatchObject({
                pointNumber: 3,
                gameId: game._id,
                teamOneStatus: PointStatus.ACTIVE,
                teamTwoStatus: PointStatus.FUTURE,
                teamOneScore: game.teamOneScore,
                teamTwoScore: game.teamTwoScore,
            })

            const keys = await client.keys('*')
            expect(keys.length).toBe(4)
        })
    })

    describe('handlers', () => {
        describe('createPoint', () => {
            let createNewPoint: Dependencies['startPoint']['helpers']['createNewPoint']
            let game: IGame
            beforeEach(async () => {
                game = await Game.create({ ...gameData, teamOneScore: 4, teamTwoScore: 3 })
                createNewPoint = startPoint.helpers.createNewPoint
            })

            it('creates first point with team one', async () => {
                const result = await createNewPoint(game, TeamNumber.ONE, 0, TeamNumber.ONE)
                expect(result).toMatchObject({
                    pointNumber: 1,
                    teamOneScore: 4,
                    teamTwoScore: 3,
                    teamOneStatus: PointStatus.ACTIVE,
                    teamTwoStatus: PointStatus.FUTURE,
                })
                expect(result.pullingTeam.name).toBe(game.teamOne.name)
                expect(result.receivingTeam.name).toBe(game.teamTwo.name)

                const points = await Point.find({})
                expect(points.length).toBe(1)
            })

            it('creates first point with team two', async () => {
                const result = await createNewPoint(game, TeamNumber.TWO, 0, TeamNumber.TWO)
                expect(result).toMatchObject({
                    pointNumber: 1,
                    teamOneScore: 4,
                    teamTwoScore: 3,
                    teamOneStatus: PointStatus.FUTURE,
                    teamTwoStatus: PointStatus.ACTIVE,
                })
                expect(result.pullingTeam.name).toBe(game.teamTwo.name)
                expect(result.receivingTeam.name).toBe(game.teamOne.name)

                const points = await Point.find({})
                expect(points.length).toBe(1)
            })

            it('updates second point with team one', async () => {
                await Point.create({
                    ...createPointData,
                    gameId: game._id,
                    pointNumber: 2,
                    teamTwoStatus: PointStatus.ACTIVE,
                    teamOneStatus: PointStatus.FUTURE,
                })
                const result = await createNewPoint(game, TeamNumber.ONE, 1, TeamNumber.ONE)
                expect(result).toMatchObject({
                    pointNumber: 2,
                    teamOneScore: 4,
                    teamTwoScore: 3,
                    teamOneStatus: PointStatus.ACTIVE,
                    teamTwoStatus: PointStatus.ACTIVE,
                })

                const points = await Point.find({})
                expect(points.length).toBe(1)
            })

            it('updates second point with team two', async () => {
                await Point.create({
                    ...createPointData,
                    gameId: game._id,
                    pointNumber: 2,
                    teamTwoStatus: PointStatus.FUTURE,
                    teamOneStatus: PointStatus.ACTIVE,
                })
                const result = await createNewPoint(game, TeamNumber.TWO, 1, TeamNumber.ONE)
                expect(result).toMatchObject({
                    pointNumber: 2,
                    teamOneScore: 4,
                    teamTwoScore: 3,
                    teamOneStatus: PointStatus.ACTIVE,
                    teamTwoStatus: PointStatus.ACTIVE,
                })

                const points = await Point.find({})
                expect(points.length).toBe(1)
            })
        })

        describe('setupRedisData', () => {
            let setupRedisData: Dependencies['startPoint']['helpers']['setupRedisData']
            beforeAll(() => {
                setupRedisData = startPoint.helpers.setupRedisData
            })

            it('sets up all keys', async () => {
                const gameId = new Types.ObjectId().toHexString()
                const pointId = new Types.ObjectId().toHexString()
                await setupRedisData(gameId, pointId, TeamNumber.ONE)

                const key1 = `${gameId}:${pointId}:one:actions`
                const key2 = `${gameId}:${pointId}:two:actions`
                const key3 = `${gameId}:${pointId}:pulling`
                const key4 = `${gameId}:${pointId}:receiving`

                const value1 = await client.get(key1)
                expect(value1).toBe('0')
                const value2 = await client.get(key2)
                expect(value2).toBe('0')
                const value3 = await client.get(key3)
                expect(value3).toBe('one')
                const value4 = await client.get(key4)
                expect(value4).toBe('two')
            })
        })
    })
})
