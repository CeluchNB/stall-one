import * as Constants from '../../../../../src/utils/constants'
import { Types } from 'mongoose'
import { container } from '../../../../../src/di'
import Game from '../../../../../src/models/game'
import Point from '../../../../../src/models/point'
import Dependencies from '../../../../../src/types/di'
import IPoint, { PointStatus } from '../../../../../src/types/point'
import {
    setUpDatabase,
    tearDownDatabase,
    resetDatabase,
    createPointData,
    gameData,
} from '../../../../fixtures/setup-db'
import { client, getRedisAction } from '../../../../../src/utils/redis'
import Action from '../../../../../src/models/action'
import { ActionType } from '../../../../../src/types/action'
import { TeamNumber } from '../../../../../src/types/ultmt'

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

describe('Back Point', () => {
    let backPoint: Dependencies['backPoint']
    beforeAll(() => {
        backPoint = container.resolve('backPoint')
    })

    describe('perform', () => {
        let perform: Dependencies['backPoint']['perform']
        beforeAll(() => {
            perform = backPoint.perform
        })

        it('handles team one request', async () => {
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

            const { point, actions } = await perform(game._id.toHexString(), 4, TeamNumber.ONE)
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

        it('handles team two request', async () => {
            const teamTwo = { _id: new Types.ObjectId(), place: 'Place', name: 'Name', teamname: 'placename' }
            const game = await Game.create({ ...gameData, teamTwo, teamOneScore: 2, teamTwoScore: 2 })
            await Point.create({
                gameId: game._id,
                pointNumber: 4,
                pullingTeam: game.teamOne,
                receivingTeam: game.teamTwo,
                teamOneStatus: PointStatus.ACTIVE,
                teamTwoStatus: PointStatus.ACTIVE,
                teamOneScore: 2,
                teamTwoScore: 2,
            })
            const prevPoint = await Point.create({
                gameId: game._id,
                pointNumber: 3,
                pullingTeam: game.teamOne,
                receivingTeam: game.teamTwo,
                teamOneStatus: PointStatus.COMPLETE,
                teamTwoStatus: PointStatus.COMPLETE,
                teamOneScore: 2,
                teamTwoScore: 1,
            })

            await Action.create({
                pointId: prevPoint._id,
                actionNumber: 1,
                team: game.teamTwo,
                actionType: ActionType.PULL,
            })
            await Action.create({
                pointId: prevPoint._id,
                actionNumber: 2,
                team: game.teamTwo,
                actionType: ActionType.TEAM_ONE_SCORE,
            })

            const { point, actions } = await perform(game._id.toHexString(), 4, TeamNumber.TWO)
            expect(point._id.toHexString()).toBe(prevPoint._id.toHexString())
            expect(point.pointNumber).toBe(3)
            expect(point.teamOneStatus).toBe(PointStatus.COMPLETE)
            expect(point.teamTwoStatus).toBe(PointStatus.ACTIVE)
            expect(actions.length).toBe(2)

            const savedActions = await Action.find({})
            expect(savedActions.length).toBe(0)

            const redisAction1 = await getRedisAction(client, prevPoint._id.toHexString(), 1, TeamNumber.TWO)
            expect(redisAction1.actionType).toBe(ActionType.PULL)

            const redisAction2 = await getRedisAction(client, prevPoint._id.toHexString(), 2, TeamNumber.TWO)
            expect(redisAction2.actionType).toBe(ActionType.TEAM_ONE_SCORE)

            const savedFuturePoint = await Point.findOne({ gameId: game._id, pointNumber: 4 })
            expect(savedFuturePoint).toMatchObject({
                teamOneScore: 2,
                teamTwoScore: 2,
                teamOneStatus: PointStatus.ACTIVE,
                teamTwoStatus: PointStatus.FUTURE,
            })

            const savedPreviousPoint = await Point.findOne({ gameId: game._id, pointNumber: 3 })
            expect(savedPreviousPoint).toMatchObject({
                teamOneScore: 2,
                teamTwoScore: 1,
                teamOneStatus: PointStatus.COMPLETE,
                teamTwoStatus: PointStatus.ACTIVE,
            })

            const savedGame = await Game.findOne({})
            expect(savedGame).toMatchObject({ teamOneScore: 2, teamTwoScore: 2 })
        })
    })

    describe('helpers', () => {
        describe('findPointByGameAndNumber', () => {
            let findPointByGameAndNumber: Dependencies['backPoint']['helpers']['findPointByGameAndNumber']
            beforeAll(() => {
                findPointByGameAndNumber = backPoint.helpers.findPointByGameAndNumber
            })

            it('returns found point', async () => {
                const point = await Point.create(createPointData)
                const result = await findPointByGameAndNumber(point.gameId.toHexString(), point.pointNumber)
                expect(result._id.toHexString()).toBe(point._id.toHexString())
            })

            it('throws error on unfound point', async () => {
                await expect(findPointByGameAndNumber(new Types.ObjectId().toHexString(), 2)).rejects.toThrow(
                    Constants.UNABLE_TO_FIND_POINT,
                )
            })
        })

        describe('validatePointStatus', () => {
            let validatePointStatus: Dependencies['backPoint']['helpers']['validatePointStatus']
            beforeAll(() => {
                validatePointStatus = backPoint.helpers.validatePointStatus
            })

            it('resolves when status matches', () => {
                expect(() => {
                    validatePointStatus(
                        { teamOneStatus: PointStatus.ACTIVE } as IPoint,
                        'teamOneStatus',
                        PointStatus.ACTIVE,
                    )
                }).not.toThrow()
            })

            it('throws when status does not match', () => {
                expect(() => {
                    validatePointStatus(
                        { teamOneStatus: PointStatus.COMPLETE } as IPoint,
                        'teamOneStatus',
                        PointStatus.ACTIVE,
                    )
                }).toThrow(Constants.CANNOT_GO_BACK_POINT)
            })
        })

        describe('pointIsInactive', () => {
            let pointIsInactive: Dependencies['backPoint']['helpers']['pointIsInactive']
            beforeAll(() => {
                pointIsInactive = backPoint.helpers.pointIsInactive
            })

            it('returns false if team one is active', () => {
                const point = { teamOneStatus: PointStatus.ACTIVE, teamTwoStatus: PointStatus.FUTURE }
                expect(pointIsInactive(point as IPoint)).toBe(false)
            })

            it('returns false if team two is active', () => {
                const point = { teamOneStatus: PointStatus.COMPLETE, teamTwoStatus: PointStatus.ACTIVE }
                expect(pointIsInactive(point as IPoint)).toBe(false)
            })

            it('returns true if both teams are inactive', () => {
                const point = { teamOneStatus: PointStatus.COMPLETE, teamTwoStatus: PointStatus.FUTURE }
                expect(pointIsInactive(point as IPoint)).toBe(true)
            })
        })

        describe('updateScores', () => {
            let updateScores: Dependencies['backPoint']['helpers']['updateScores']
            beforeAll(() => {
                updateScores = backPoint.helpers.updateScores
            })

            it('updats scores', async () => {
                const game = await Game.create({ ...gameData, teamOneScore: 0, teamTwoScore: 0 })
                const point1 = await Point.create({ ...createPointData, teamOneScore: 0, teamTwoScore: 0 })
                const point2 = await Point.create({
                    ...createPointData,
                    _id: new Types.ObjectId(),
                    teamOneScore: 5,
                    teamTwoScore: 4,
                })

                updateScores(point1, game, point2)
                expect(game).toMatchObject({ teamOneScore: 5, teamTwoScore: 4 })
                expect(point1).toMatchObject({ teamOneScore: 5, teamTwoScore: 4 })
            })
        })

        describe('deleteRedisData', () => {
            let deleteRedisData: Dependencies['backPoint']['helpers']['deleteRedisData']
            beforeAll(() => {
                deleteRedisData = backPoint.helpers.deleteRedisData
            })

            it('deletes all data', async () => {
                const gameId = new Types.ObjectId().toHexString()
                const pointId = new Types.ObjectId().toHexString()
                await client.set(`${gameId}:${pointId}:one:actions`, 1)
                await client.set(`${gameId}:${pointId}:two:actions`, 1)
                await client.set(`${gameId}:${pointId}:pulling`, 3)
                await client.set(`${gameId}:${pointId}:receiving`, 3)

                await deleteRedisData(gameId, pointId)

                const keys = await client.keys('*')
                expect(keys.length).toBe(0)
            })
        })

        describe('transferActionsToRedis', () => {
            let transferActionsToRedis: Dependencies['backPoint']['helpers']['transferActionsToRedis']
            beforeAll(() => {
                transferActionsToRedis = backPoint.helpers.transferActionsToRedis
            })

            it('transfers team one actions', async () => {
                const game = await Game.create(gameData)
                const point = await Point.create(createPointData)
                const action1 = await Action.create({
                    pointId: point._id,
                    team: game.teamOne,
                    actionNumber: 1,
                    actionType: ActionType.PULL,
                })
                const action2 = await Action.create({
                    pointId: point._id,
                    team: game.teamOne,
                    actionNumber: 2,
                    actionType: ActionType.TEAM_TWO_SCORE,
                })

                const result = await transferActionsToRedis(game, point, TeamNumber.ONE)
                expect(result[0].actionType).toBe(action1.actionType)
                expect(result[1].actionType).toBe(action2.actionType)

                const actions = await Action.find({})
                expect(actions.length).toBe(0)

                const redisAction1 = await getRedisAction(client, point._id.toHexString(), 1, TeamNumber.ONE)
                expect(redisAction1.actionType).toBe(action1.actionType)

                const redisAction2 = await getRedisAction(client, point._id.toHexString(), 2, TeamNumber.ONE)
                expect(redisAction2.actionType).toBe(action2.actionType)
            })

            it('transfers team two actions', async () => {
                const teamTwo = {
                    _id: new Types.ObjectId(),
                    place: 'Place',
                    name: 'Name',
                    teamname: 'placename',
                }
                const game = await Game.create({ ...gameData, teamTwo })
                const point = await Point.create(createPointData)
                const action1 = await Action.create({
                    pointId: point._id,
                    team: game.teamTwo,
                    actionNumber: 1,
                    actionType: ActionType.PULL,
                })
                const action2 = await Action.create({
                    pointId: point._id,
                    team: game.teamTwo,
                    actionNumber: 2,
                    actionType: ActionType.TEAM_ONE_SCORE,
                })

                const result = await transferActionsToRedis(game, point, TeamNumber.TWO)
                expect(result[0].actionType).toBe(action1.actionType)
                expect(result[1].actionType).toBe(action2.actionType)

                const actions = await Action.find({})
                expect(actions.length).toBe(0)

                const redisAction1 = await getRedisAction(client, point._id.toHexString(), 1, TeamNumber.TWO)
                expect(redisAction1.actionType).toBe(action1.actionType)

                const redisAction2 = await getRedisAction(client, point._id.toHexString(), 2, TeamNumber.TWO)
                expect(redisAction2.actionType).toBe(action2.actionType)
            })
        })

        describe('setRedisData', () => {
            let setRedisData: Dependencies['backPoint']['helpers']['setRedisData']
            beforeAll(() => {
                setRedisData = backPoint.helpers.setRedisData
            })

            it('sets team one pulling data', async () => {
                const gameId = new Types.ObjectId().toHexString()
                const pointId = new Types.ObjectId().toHexString()

                await setRedisData(gameId, pointId, TeamNumber.ONE)

                const pulling = await client.get(`${gameId}:${pointId}:pulling`)
                expect(pulling).toBe('one')

                const receiving = await client.get(`${gameId}:${pointId}:receiving`)
                expect(receiving).toBe('two')
            })

            it('sets team two pulling data', async () => {
                const gameId = new Types.ObjectId().toHexString()
                const pointId = new Types.ObjectId().toHexString()

                await setRedisData(gameId, pointId, TeamNumber.TWO)

                const pulling = await client.get(`${gameId}:${pointId}:pulling`)
                expect(pulling).toBe('two')

                const receiving = await client.get(`${gameId}:${pointId}:receiving`)
                expect(receiving).toBe('one')
            })
        })

        describe('getPullingTeam', () => {
            let getPullingTeam: Dependencies['backPoint']['helpers']['getPullingTeam']
            beforeAll(() => {
                getPullingTeam = backPoint.helpers.getPullingTeam
            })

            it('finds pulling team one', async () => {
                const game = await Game.create(gameData)
                const point = await Point.create({ ...createPointData, pullingTeam: game.teamOne })
                const result = getPullingTeam(point, game)
                expect(result).toBe(TeamNumber.ONE)
            })

            it('finds pulling team two', async () => {
                const game = await Game.create(gameData)
                const point = await Point.create({ ...createPointData, pullingTeam: game.teamTwo })
                const result = getPullingTeam(point, game)
                expect(result).toBe(TeamNumber.TWO)
            })
        })
    })
})
