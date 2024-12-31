import * as Constants from '../../../../src/utils/constants'
import { container } from '../../../../src/di'
import Point from '../../../../src/models/point'
import { createPointData, gameData, resetDatabase, setUpDatabase, tearDownDatabase } from '../../../fixtures/setup-db'
import '../../../../src/services/v2/point'
import Game from '../../../../src/models/game'
import { TeamNumber } from '../../../../src/types/ultmt'
import { PointStatus } from '../../../../src/types/point'
import { client, getRedisAction, saveRedisAction } from '../../../../src/utils/redis'
import { ActionType } from '../../../../src/types/action'
import { Types } from 'mongoose'
import Action from '../../../../src/models/action'

jest.mock('@google-cloud/tasks')

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
                Constants.NO_PREVIOUS_POINT,
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

    describe('back', () => {
        let back: any
        beforeAll(() => {
            back = container.resolve('pointServiceV2').back
        })
        it('goes back a point', async () => {
            const game = await Game.create({ ...gameData, teamOneScore: 3, teamTwoScore: 2 })
            await Point.create({
                gameId: game._id,
                pointNumber: 4,
                pullingTeam: game.teamOne,
                receivingTeam: game.teamTwo,
                teamOneStatus: PointStatus.ACTIVE,
                teamTwoStatus: PointStatus.FUTURE,
                teamOneScore: 2,
                teamTwoScore: 2,
            })
            const prevPoint = await Point.create({
                gameId: game._id,
                pointNumber: 3,
                pullingTeam: game.teamOne,
                receivingTeam: game.teamTwo,
                teamOneStatus: PointStatus.COMPLETE,
                teamTwoStatus: PointStatus.ACTIVE,
                teamOneScore: 2,
                teamTwoScore: 1,
            })

            await Action.create({
                pointId: prevPoint._id,
                actionNumber: 1,
                team: game.teamOne,
                actionType: ActionType.PULL,
            })
            await Action.create({
                pointId: prevPoint._id,
                actionNumber: 2,
                team: game.teamOne,
                actionType: ActionType.TEAM_TWO_SCORE,
            })

            const { point, actions } = await back(game._id.toHexString(), TeamNumber.ONE, 4)
            expect(point._id.toHexString()).toBe(prevPoint._id.toHexString())
            expect(point.pointNumber).toBe(3)
            expect(point.teamOneStatus).toBe(PointStatus.ACTIVE)
            expect(point.teamTwoStatus).toBe(PointStatus.ACTIVE)
            expect(actions.length).toBe(2)

            const savedActions = await Action.find({})
            expect(savedActions.length).toBe(0)

            const redisAction1 = await getRedisAction(client, prevPoint._id.toHexString(), 1, TeamNumber.ONE)
            expect(redisAction1.actionType).toBe(ActionType.PULL)

            const redisAction2 = await getRedisAction(client, prevPoint._id.toHexString(), 2, TeamNumber.ONE)
            expect(redisAction2.actionType).toBe(ActionType.TEAM_TWO_SCORE)

            const savedFuturePoint = await Point.findOne({ gameId: game._id, pointNumber: 4 })
            expect(savedFuturePoint).toMatchObject({
                teamOneScore: 2,
                teamTwoScore: 1,
                teamOneStatus: PointStatus.FUTURE,
                teamTwoStatus: PointStatus.FUTURE,
            })

            const savedPreviousPoint = await Point.findOne({ gameId: game._id, pointNumber: 3 })
            expect(savedPreviousPoint).toMatchObject({
                teamOneScore: 2,
                teamTwoScore: 1,
                teamOneStatus: PointStatus.ACTIVE,
                teamTwoStatus: PointStatus.ACTIVE,
            })

            const savedGame = await Game.findOne({})
            expect(savedGame).toMatchObject({ teamOneScore: 2, teamTwoScore: 1 })
        })
    })
})
