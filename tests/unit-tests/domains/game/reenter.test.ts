import * as UltmtUtils from '../../../../src/utils/ultmt'
import { Types } from 'mongoose'
import { container } from '../../../../src/di'
import Point from '../../../../src/models/point'
import Dependencies from '../../../../src/types/di'
import { PointStatus } from '../../../../src/types/point'
import { Player, TeamNumber, TeamResponse } from '../../../../src/types/ultmt'
import { client, getRedisAction, saveRedisAction } from '../../../../src/utils/redis'
import { setUpDatabase, tearDownDatabase, resetDatabase, createPointData, gameData } from '../../../fixtures/setup-db'
import Game from '../../../../src/models/game'
import { ActionType } from '../../../../src/types/action'
import Action from '../../../../src/models/action'

jest.mock('@google-cloud/tasks')

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
    beforeEach(() => {
        reenterGame = container.resolve('reenterGame')
        const user1: Player = {
            _id: new Types.ObjectId(),
            firstName: 'Kenny',
            lastName: 'Furdella',
            username: 'kenny',
        }
        const team: TeamResponse = {
            _id: new Types.ObjectId(),
            place: 'PGH',
            name: 'Temper',
            teamname: 'pghtemper',
            seasonStart: new Date(),
            seasonEnd: new Date(),
            players: [],
        }
        jest.spyOn(UltmtUtils, 'authenticateManager').mockReturnValue(Promise.resolve(user1))
        jest.spyOn(UltmtUtils, 'getTeam').mockReturnValue(Promise.resolve(team))
    })

    describe('perform', () => {
        it('reenters a game on an active point', async () => {
            const game = await Game.create(gameData)
            const point = await Point.create({
                ...createPointData,
                gameId: game._id,
                teamOneScore: 1,
                teamTwoScore: 1,
                pointNumber: 3,
                teamOneStatus: PointStatus.ACTIVE,
                teamTwoStatus: PointStatus.FUTURE,
            })
            await Point.create({
                ...createPointData,
                _id: new Types.ObjectId(),
                gameId: game._id,
                teamOneScore: 0,
                teamTwoScore: 0,
                pointNumber: 2,
                teamOneStatus: PointStatus.COMPLETE,
            })

            await client.set(`${game._id.toHexString()}:${point._id.toHexString()}:one:actions`, 1)
            await saveRedisAction(
                client,
                {
                    actionNumber: 1,
                    actionType: ActionType.PULL,
                    comments: [],
                    tags: [],
                    teamNumber: TeamNumber.ONE,
                },
                point._id.toHexString(),
            )

            const result = await reenterGame.perform(game._id.toHexString(), 'userjwt', game.teamOne._id!.toHexString())
            expect(result.actions?.length).toBe(1)
            expect(result.actions?.[0].actionType).toBe(ActionType.PULL)
            expect(result.token.length).toBeGreaterThan(25)
            expect(result.game._id.toHexString()).toBe(game._id.toHexString())
            expect(result.point?._id.toHexString()).toBe(point._id.toHexString())
            expect(result.point?.teamOneStatus).toBe(PointStatus.ACTIVE)
        })

        it('reenters a game on a complete point', async () => {
            const game = await Game.create({ ...gameData, teamTwo: { _id: new Types.ObjectId(), name: 'Name' } })
            const point = await Point.create({
                ...createPointData,
                gameId: game._id,
                teamOneScore: 1,
                teamTwoScore: 1,
                pointNumber: 3,
                teamOneStatus: PointStatus.COMPLETE,
                teamTwoStatus: PointStatus.COMPLETE,
            })
            await Point.create({
                ...createPointData,
                _id: new Types.ObjectId(),
                gameId: game._id,
                teamOneScore: 0,
                teamTwoScore: 0,
                pointNumber: 2,
                teamOneStatus: PointStatus.COMPLETE,
                teamTwoStatus: PointStatus.COMPLETE,
            })
            await Action.create({
                actionNumber: 1,
                actionType: ActionType.PULL,
                team: game.teamTwo,
                pointId: point._id,
            })

            const result = await reenterGame.perform(game._id.toHexString(), 'userjwt', game.teamTwo._id!.toHexString())
            expect(result.actions?.length).toBe(1)
            expect(result.actions?.[0].actionType).toBe(ActionType.PULL)
            expect(result.token.length).toBeGreaterThan(25)
            expect(result.game._id.toHexString()).toBe(game._id.toHexString())
            expect(result.point?._id.toHexString()).toBe(point._id.toHexString())
            expect(result.point?.teamTwoStatus).toBe(PointStatus.ACTIVE)
            expect(result.point?.teamOneScore).toBe(0)
            expect(result.point?.teamTwoScore).toBe(0)
        })

        it('returns game data with unfound point', async () => {
            const game = await Game.create(gameData)
            const result = await reenterGame.perform(game._id.toHexString(), 'userjwt', game.teamOne._id!.toHexString())
            expect(result.actions).toBeUndefined()
            expect(result.token.length).toBeGreaterThan(25)
            expect(result.game._id.toHexString()).toBe(game._id.toHexString())
            expect(result.point).toBeUndefined()
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

        describe('reactivateCompletePoint', () => {
            let reactivateCompletePoint: Dependencies['reenterGame']['helpers']['reactivateCompletePoint']
            beforeAll(() => {
                reactivateCompletePoint = reenterGame.helpers.reactivateCompletePoint
            })

            it('successfully reactivates point for team one', async () => {
                const game = await Game.create(gameData)
                const point = await Point.create({
                    ...createPointData,
                    gameId: game._id,
                    teamOneScore: 1,
                    teamTwoScore: 1,
                    pointNumber: 3,
                    teamOneStatus: PointStatus.COMPLETE,
                    teamTwoStatus: PointStatus.FUTURE,
                })
                await Point.create({
                    ...createPointData,
                    _id: new Types.ObjectId(),
                    gameId: game._id,
                    teamOneScore: 0,
                    teamTwoScore: 0,
                    pointNumber: 2,
                })
                await Action.create({
                    actionNumber: 1,
                    actionType: ActionType.PULL,
                    team: game.teamOne,
                    pointId: point._id,
                })

                await reactivateCompletePoint(game, point, TeamNumber.ONE)

                expect(point).toMatchObject({
                    teamOneStatus: PointStatus.ACTIVE,
                    teamTwoStatus: PointStatus.FUTURE,
                    teamOneScore: 0,
                    teamTwoScore: 0,
                })
                const keys = await client.keys('*')
                expect(keys.length).toBeGreaterThan(3)

                const action = await getRedisAction(client, point._id.toHexString(), 1, TeamNumber.ONE)
                expect(action.actionType).toBe(ActionType.PULL)
            })

            it('reactivates point for team two', async () => {
                const game = await Game.create({ ...gameData, teamTwo: { _id: new Types.ObjectId(), name: 'Name' } })
                const point = await Point.create({
                    ...createPointData,
                    gameId: game._id,
                    teamOneScore: 1,
                    teamTwoScore: 1,
                    pointNumber: 3,
                    teamOneStatus: PointStatus.COMPLETE,
                    teamTwoStatus: PointStatus.COMPLETE,
                })
                await Point.create({
                    ...createPointData,
                    _id: new Types.ObjectId(),
                    gameId: game._id,
                    teamOneScore: 0,
                    teamTwoScore: 0,
                    pointNumber: 2,
                })
                await Action.create({
                    actionNumber: 1,
                    actionType: ActionType.PULL,
                    team: game.teamTwo,
                    pointId: point._id,
                })

                await reactivateCompletePoint(game, point, TeamNumber.TWO)

                expect(point).toMatchObject({
                    teamOneStatus: PointStatus.COMPLETE,
                    teamTwoStatus: PointStatus.ACTIVE,
                    teamOneScore: 0,
                    teamTwoScore: 0,
                })
                const keys = await client.keys('*')
                expect(keys.length).toBeGreaterThan(3)

                const action = await getRedisAction(client, point._id.toHexString(), 1, TeamNumber.TWO)
                expect(action.actionType).toBe(ActionType.PULL)
            })
        })

        describe('updateScore', () => {
            let updateScore: Dependencies['reenterGame']['helpers']['updateScore']
            beforeAll(() => {
                updateScore = helpers.updateScore
            })

            it('updates score of point with previous point', async () => {
                const point = await Point.create({
                    ...createPointData,
                    pointNumber: 2,
                    teamOneScore: 7,
                    teamTwoScore: 7,
                })
                await Point.create({
                    ...createPointData,
                    _id: new Types.ObjectId(),
                    pointNumber: 1,
                    teamOneScore: 0,
                    teamTwoScore: 0,
                })

                await updateScore(point.gameId, point)
                expect(point.teamOneScore).toBe(0)
                expect(point.teamTwoScore).toBe(0)
            })

            it('makes no update if previous point does not exist', async () => {
                const point = await Point.create({
                    ...createPointData,
                    pointNumber: 2,
                    teamOneScore: 7,
                    teamTwoScore: 7,
                })

                await updateScore(point.gameId, point)
                expect(point.teamOneScore).toBe(7)
                expect(point.teamTwoScore).toBe(7)
            })
        })

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
