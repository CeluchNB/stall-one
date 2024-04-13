import * as Constants from '../../../../../src/utils/constants'
import { Types } from 'mongoose'
import { container } from '../../../../../src/di'
import Game from '../../../../../src/models/game'
import Point from '../../../../../src/models/point'
import { ActionType, RedisAction } from '../../../../../src/types/action'
import Dependencies from '../../../../../src/types/di'
import { PointStatus } from '../../../../../src/types/point'
import { Team, TeamNumber } from '../../../../../src/types/ultmt'
import {
    setUpDatabase,
    tearDownDatabase,
    resetDatabase,
    createPointData,
    gameData,
} from '../../../../fixtures/setup-db'
import Action from '../../../../../src/models/action'
import { client, saveRedisAction } from '../../../../../src/utils/redis'

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

describe('Next Point Domain', () => {
    describe('Finish Point', () => {
        let finishPoint: Dependencies['finishPoint']
        beforeAll(() => {
            finishPoint = container.resolve('finishPoint')
        })

        describe('perform', () => {
            it('updates point successfully', async () => {
                const game = await Game.create(gameData)
                const point = await Point.create(createPointData)
                await client.set(`${game._id.toHexString()}:${point._id.toHexString()}:one:actions`, 1)
                await saveRedisAction(
                    client,
                    {
                        teamNumber: 'one',
                        actionNumber: 1,
                        actionType: ActionType.TEAM_ONE_SCORE,
                        comments: [],
                        tags: [],
                    },
                    point._id.toHexString(),
                )

                const result = await finishPoint.perform(
                    game._id.toHexString(),
                    TeamNumber.ONE,
                    point._id.toHexString(),
                )
                expect(result.teamOneScore).toBe(1)
                expect(result.scoringTeam?.name).toBe(game.teamOne.name)

                const updatedGame = await Game.findOne({})
                expect(updatedGame?.teamOneScore).toBe(1)
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

            describe('checkConflictingLiveScore', () => {
                const gameId = new Types.ObjectId().toHexString()
                const team = TeamNumber.ONE
                const pointId = new Types.ObjectId().toHexString()
                const lastAction = {
                    actionNumber: 1,
                    actionType: ActionType.TEAM_ONE_SCORE,
                    teamNumber: team,
                    comments: [],
                    tags: [],
                }
                let checkConflictingLiveScore: Dependencies['finishPoint']['helpers']['checkConflictingLiveScore']
                beforeAll(() => {
                    checkConflictingLiveScore = finishPoint.helpers.checkConflictingLiveScore
                })

                it('returns false with missing current actions', async () => {
                    const result = await checkConflictingLiveScore(gameId, team, pointId, lastAction)
                    expect(result).toBe(false)
                })

                it('returns false with zero total actions', async () => {
                    await client.set(`${gameId}:${pointId}:${TeamNumber.TWO}:actions`, 0)
                    const result = await checkConflictingLiveScore(gameId, team, pointId, lastAction)
                    expect(result).toBe(false)
                })

                it('returns false with missing action', async () => {
                    await client.set(`${gameId}:${pointId}:${TeamNumber.TWO}:actions`, 1)
                    const result = await checkConflictingLiveScore(gameId, team, pointId, lastAction)
                    expect(result).toBe(false)
                })

                it('returns true with conflicting score', async () => {
                    await client.set(`${gameId}:${pointId}:${TeamNumber.TWO}:actions`, 1)
                    await saveRedisAction(
                        client,
                        { ...lastAction, teamNumber: TeamNumber.TWO, actionType: ActionType.TEAM_TWO_SCORE },
                        pointId,
                    )
                    const result = await checkConflictingLiveScore(gameId, team, pointId, lastAction)
                    expect(result).toBe(true)
                })
            })

            describe('throwIfConflictingScore', () => {
                let throwIfConflictingScore: Dependencies['finishPoint']['helpers']['throwIfConflictingScore']
                beforeAll(() => {
                    throwIfConflictingScore = finishPoint.helpers.throwIfConflictingScore
                })

                it('throws if conflicting saved score', async () => {
                    const teamTwo: Team = {
                        _id: new Types.ObjectId(),
                        name: 'test',
                    }
                    const game = await Game.create({ ...gameData, teamTwo })
                    const point = await Point.create(createPointData)

                    await Action.create({
                        pointId: point._id,
                        actionNumber: 5,
                        team: game.teamTwo,
                        actionType: ActionType.TEAM_TWO_SCORE,
                    })
                    await expect(
                        throwIfConflictingScore(game, TeamNumber.ONE, point, {
                            actionNumber: 1,
                            teamNumber: 'one',
                            comments: [],
                            actionType: ActionType.TEAM_ONE_SCORE,
                            tags: [],
                        }),
                    ).rejects.toThrow(Constants.CONFLICTING_SCORE)
                })

                it('throws if conflicting live score', async () => {
                    const game = await Game.create(gameData)
                    const point = await Point.create(createPointData)
                    const lastAction = {
                        actionNumber: 1,
                        actionType: ActionType.TEAM_ONE_SCORE,
                        teamNumber: TeamNumber.ONE,
                        comments: [],
                        tags: [],
                    }

                    await client.set(
                        `${game._id.toHexString()}:${point._id.toHexString()}:${TeamNumber.TWO}:actions`,
                        1,
                    )
                    await saveRedisAction(
                        client,
                        { ...lastAction, teamNumber: TeamNumber.TWO, actionType: ActionType.TEAM_TWO_SCORE },
                        point._id.toHexString(),
                    )
                    await expect(
                        throwIfConflictingScore(game, TeamNumber.ONE, point, {
                            actionNumber: 1,
                            teamNumber: 'one',
                            comments: [],
                            actionType: ActionType.TEAM_ONE_SCORE,
                            tags: [],
                        }),
                    ).rejects.toThrow(Constants.CONFLICTING_SCORE)
                })

                it('does not throw with no conflicting score', async () => {
                    const game = await Game.create(gameData)
                    const point = await Point.create(createPointData)
                    await expect(
                        throwIfConflictingScore(game, TeamNumber.ONE, point, {
                            actionNumber: 1,
                            teamNumber: 'one',
                            comments: [],
                            actionType: ActionType.TEAM_ONE_SCORE,
                            tags: [],
                        }),
                    ).resolves.toBeUndefined()
                })
            })

            describe('updatePointScore', () => {
                let updatePointScore: Dependencies['finishPoint']['helpers']['updatePointScore']
                beforeAll(() => {
                    updatePointScore = finishPoint.helpers.updatePointScore
                })

                it('updates team one score with previous point', async () => {
                    const game = await Game.create(gameData)
                    const lastAction: RedisAction = {
                        actionNumber: 1,
                        actionType: ActionType.TEAM_ONE_SCORE,
                        teamNumber: 'one',
                        comments: [],
                        tags: [],
                    }
                    await Point.create(createPointData)
                    const point = await Point.create({ ...createPointData, _id: new Types.ObjectId(), pointNumber: 2 })

                    await updatePointScore(point, lastAction, game)
                    expect(point.teamOneScore).toBe(1)
                    expect(point.scoringTeam?.name).toBe(game.teamOne.name)
                })

                it('updates team one score without previous point', async () => {
                    const game = await Game.create(gameData)
                    const lastAction: RedisAction = {
                        actionNumber: 1,
                        actionType: ActionType.TEAM_ONE_SCORE,
                        teamNumber: 'one',
                        comments: [],
                        tags: [],
                    }
                    const point = await Point.create({ ...createPointData, _id: new Types.ObjectId(), pointNumber: 1 })

                    await updatePointScore(point, lastAction, game)
                    expect(point.teamOneScore).toBe(1)
                    expect(point.scoringTeam?.name).toBe(game.teamOne.name)
                })

                it('updates team two score', async () => {
                    const game = await Game.create(gameData)
                    const lastAction: RedisAction = {
                        actionNumber: 1,
                        actionType: ActionType.TEAM_TWO_SCORE,
                        teamNumber: 'one',
                        comments: [],
                        tags: [],
                    }
                    await Point.create(createPointData)
                    const point = await Point.create({ ...createPointData, _id: new Types.ObjectId(), pointNumber: 2 })

                    await updatePointScore(point, lastAction, game)
                    expect(point.teamTwoScore).toBe(1)
                    expect(point.scoringTeam?.name).toBe(game.teamTwo.name)
                })

                it('updates team two score without previous point', async () => {
                    const game = await Game.create(gameData)
                    const lastAction: RedisAction = {
                        actionNumber: 1,
                        actionType: ActionType.TEAM_TWO_SCORE,
                        teamNumber: 'one',
                        comments: [],
                        tags: [],
                    }
                    const point = await Point.create({ ...createPointData, _id: new Types.ObjectId(), pointNumber: 1 })

                    await updatePointScore(point, lastAction, game)
                    expect(point.teamTwoScore).toBe(1)
                    expect(point.scoringTeam?.name).toBe(game.teamTwo.name)
                })

                it('throws if last action is not score', async () => {
                    const game = await Game.create(gameData)
                    const lastAction: RedisAction = {
                        actionNumber: 1,
                        actionType: ActionType.PULL,
                        teamNumber: 'one',
                        comments: [],
                        tags: [],
                    }
                    const point = await Point.create({ ...createPointData, _id: new Types.ObjectId(), pointNumber: 1 })

                    await expect(updatePointScore(point, lastAction, game)).rejects.toThrow(Constants.SCORE_REQUIRED)
                })
            })

            describe('handleTeamScoreReport', () => {
                let handleTeamScoreReport: Dependencies['finishPoint']['helpers']['handleTeamScoreReport']
                beforeAll(() => {
                    handleTeamScoreReport = finishPoint.helpers.handleTeamScoreReport
                })

                it('updates score with team one reporting first', async () => {
                    const game = await Game.create(gameData)
                    const point = await Point.create(createPointData)
                    await client.set(`${game._id.toHexString()}:${point._id.toHexString()}:one:actions`, 1)
                    await saveRedisAction(
                        client,
                        {
                            teamNumber: 'one',
                            actionNumber: 1,
                            actionType: ActionType.TEAM_ONE_SCORE,
                            comments: [],
                            tags: [],
                        },
                        point._id.toHexString(),
                    )

                    const result = await handleTeamScoreReport(game, TeamNumber.ONE, point)
                    expect(result.teamOneScore).toBe(1)
                })

                it('updates score with team two reporting first', async () => {
                    const game = await Game.create(gameData)
                    const point = await Point.create(createPointData)
                    await client.set(`${game._id.toHexString()}:${point._id.toHexString()}:two:actions`, 1)
                    await saveRedisAction(
                        client,
                        {
                            teamNumber: 'two',
                            actionNumber: 1,
                            actionType: ActionType.TEAM_ONE_SCORE,
                            comments: [],
                            tags: [],
                        },
                        point._id.toHexString(),
                    )

                    const result = await handleTeamScoreReport(game, TeamNumber.TWO, point)
                    expect(result.teamOneScore).toBe(1)
                })

                it('throws if score is conflicting', async () => {
                    const game = await Game.create({
                        ...gameData,
                        teamTwo: { _id: new Types.ObjectId(), name: 'Team two' },
                    })
                    const point = await Point.create({ ...createPointData, teamOneStatus: 'complete' })
                    await client.set(`${game._id.toHexString()}:${point._id.toHexString()}:two:actions`, 1)
                    await saveRedisAction(
                        client,
                        {
                            teamNumber: 'two',
                            actionNumber: 1,
                            actionType: ActionType.TEAM_ONE_SCORE,
                            comments: [],
                            tags: [],
                        },
                        point._id.toHexString(),
                    )

                    await Action.create({
                        pointId: point._id,
                        actionNumber: 1,
                        actionType: ActionType.TEAM_TWO_SCORE,
                        team: game.teamOne,
                    })

                    await expect(handleTeamScoreReport(game, TeamNumber.TWO, point)).rejects.toThrowError(
                        Constants.CONFLICTING_SCORE,
                    )
                })
            })
        })
    })
})
