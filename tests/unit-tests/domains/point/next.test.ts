import { Types } from 'mongoose'
import { container } from '../../../../src/di'
import Game from '../../../../src/models/game'
import Point from '../../../../src/models/point'
import { ActionType } from '../../../../src/types/action'
import Dependencies from '../../../../src/types/di'
import { PointStatus } from '../../../../src/types/point'
import { Team, TeamNumber } from '../../../../src/types/ultmt'
import { setUpDatabase, tearDownDatabase, resetDatabase, createPointData, gameData } from '../../../fixtures/setup-db'
import Action from '../../../../src/models/action'

beforeAll(async () => {
    await setUpDatabase()
})

beforeEach(async () => {
    await resetDatabase()
})

afterAll(async () => {
    await tearDownDatabase()
})

describe('Next Point Domain', () => {
    describe('Finish Point', () => {
        let finishPoint: Dependencies['finishPoint']
        beforeAll(() => {
            finishPoint = container.resolve('finishPoint')
        })

        describe('perform', () => {
            it('sample test', () => {
                expect(1 + 1).toBe(2)
            })
        })

        describe('helpers', () => {
            describe('updatePointStatus', () => {
                it('updates team one status', async () => {
                    const {
                        helpers: { completePoint },
                    } = finishPoint

                    const point = await Point.create(createPointData)
                    completePoint(point, TeamNumber.ONE)
                    expect(point.teamOneStatus).toBe(PointStatus.COMPLETE)
                })

                it('updates team two status', async () => {
                    const {
                        helpers: { completePoint },
                    } = finishPoint

                    const point = await Point.create(createPointData)
                    completePoint(point, TeamNumber.TWO)
                    expect(point.teamTwoStatus).toBe(PointStatus.COMPLETE)
                })
            })

            describe('updateGameScore', () => {
                it('successfully updates game', async () => {
                    const {
                        helpers: { updateGameScore },
                    } = finishPoint
                    const game = await Game.create(gameData)
                    const point = await Point.create(createPointData)
                    point.teamOneScore = 99
                    point.teamTwoScore = 99

                    updateGameScore(game, point)
                    expect(game).toMatchObject({ teamOneScore: 99, teamTwoScore: 99 })
                })
            })

            describe('checkConflictingSavedScore', () => {
                let checkConflictingSavedScore: Dependencies['finishPoint']['helpers']['checkConflictingSavedScore']
                beforeAll(() => {
                    checkConflictingSavedScore = finishPoint.helpers.checkConflictingSavedScore
                })

                it('returns false with unfound team', async () => {
                    const result = await checkConflictingSavedScore(
                        '',
                        { name: 'test' },
                        {
                            actionNumber: 1,
                            teamNumber: 'one',
                            comments: [],
                            actionType: ActionType.TEAM_ONE_SCORE,
                            tags: [],
                        },
                    )
                    expect(result).toBe(false)
                })

                it('returns false with unfound actions', async () => {
                    const point = await Point.create(createPointData)
                    const team: Team = {
                        _id: new Types.ObjectId(),
                        name: 'Team',
                    }

                    const result = await checkConflictingSavedScore(point._id.toHexString(), team, {
                        actionNumber: 1,
                        teamNumber: 'one',
                        comments: [],
                        actionType: ActionType.TEAM_ONE_SCORE,
                        tags: [],
                    })
                    expect(result).toBe(false)
                })

                it('returns false with same score', async () => {
                    const point = await Point.create(createPointData)
                    const team: Team = {
                        _id: new Types.ObjectId(),
                        name: 'Team',
                    }
                    await Action.create({
                        pointId: point._id,
                        actionNumber: 2,
                        team,
                        actionType: ActionType.CATCH,
                    })
                    await Action.create({
                        pointId: point._id,
                        actionNumber: 5,
                        team,
                        actionType: ActionType.TEAM_ONE_SCORE,
                    })
                    await Action.create({
                        pointId: point._id,
                        actionNumber: 3,
                        team,
                        actionType: ActionType.CATCH,
                    })

                    const result = await checkConflictingSavedScore(point._id.toHexString(), team, {
                        actionNumber: 1,
                        teamNumber: 'one',
                        comments: [],
                        actionType: ActionType.TEAM_ONE_SCORE,
                        tags: [],
                    })
                    expect(result).toBe(false)
                })

                it('returns true when redis score is different than saved score', async () => {
                    const point = await Point.create(createPointData)
                    const team: Team = {
                        _id: new Types.ObjectId(),
                        name: 'Team',
                    }
                    await Action.create({
                        pointId: point._id,
                        actionNumber: 2,
                        team,
                        actionType: ActionType.CATCH,
                    })
                    await Action.create({
                        pointId: point._id,
                        actionNumber: 5,
                        team,
                        actionType: ActionType.TEAM_TWO_SCORE,
                    })
                    await Action.create({
                        pointId: point._id,
                        actionNumber: 3,
                        team,
                        actionType: ActionType.CATCH,
                    })

                    const result = await checkConflictingSavedScore(point._id.toHexString(), team, {
                        actionNumber: 1,
                        teamNumber: 'one',
                        comments: [],
                        actionType: ActionType.TEAM_ONE_SCORE,
                        tags: [],
                    })
                    expect(result).toBe(true)
                })
            })
        })
    })
})
