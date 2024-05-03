/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as Constants from '../../../../src/utils/constants'
import * as UltmtUtils from '../../../../src/utils/ultmt'
import Action from '../../../../src/models/action'
import Game from '../../../../src/models/game'
import Point from '../../../../src/models/point'
import axios from 'axios'
import {
    setUpDatabase,
    tearDownDatabase,
    getMock,
    resetDatabase,
    gameData,
    createPointData,
} from '../../../fixtures/setup-db'
import { client } from '../../../../src/utils/redis'
import { Types } from 'mongoose'
import { getRedisAction, saveRedisAction } from '../../../../src/utils/redis'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { ActionType, ClientAction } from '../../../../src/types/action'
import { container } from '../../../../src/di'
import { Player, TeamNumber } from '../../../../src/types/ultmt'
import { ClientPoint, PointStatus } from '../../../../src/types/point'
import { CreateFullGame, GameStatus } from '../../../../src/types/game'

jest.mock('@google-cloud/tasks/build/src/v2')

beforeEach(() => {
    jest.spyOn(axios, 'get').mockImplementation(getMock)
})

afterEach(() => {
    jest.spyOn(axios, 'get').mockReset()
})

beforeAll(async () => {
    await client.connect()
    await setUpDatabase()
})

afterEach(async () => {
    await resetDatabase()
})

afterAll(async () => {
    await tearDownDatabase()
    client.quit()
})

describe('Game Services v2', () => {
    const user1: Player = {
        _id: new Types.ObjectId(),
        firstName: 'Kenny',
        lastName: 'Furdella',
        username: 'kenny',
    }
    describe('reactivate game', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let reactivateGame: any
        beforeAll(() => {
            reactivateGame = container.resolve('gameServiceV2').reactivateGame
        })
        const teamOne = {
            _id: new Types.ObjectId(),
            name: 'Team One',
            place: 'Place One',
            teamname: 'team1',
        }
        const teamTwo = {
            _id: new Types.ObjectId(),
            name: 'Team Two',
            place: 'Place Two',
            teamname: 'team2',
        }

        const gameId = new Types.ObjectId()
        const pointOneId = new Types.ObjectId(0)
        beforeEach(async () => {
            const action11 = await Action.create({
                team: teamOne,
                actionNumber: 1,
                actionType: 'Catch',
                pointId: pointOneId,
            })
            const action12 = await Action.create({
                team: teamOne,
                actionNumber: 2,
                actionType: 'Catch',
                pointId: pointOneId,
            })
            const action13 = await Action.create({
                team: teamOne,
                actionNumber: 3,
                actionType: 'TeamOneScore',
                pointId: pointOneId,
            })

            const action21 = await Action.create({
                team: teamTwo,
                actionNumber: 1,
                actionType: 'Pull',
                pointId: pointOneId,
            })
            const action22 = await Action.create({
                team: teamTwo,
                actionNumber: 2,
                actionType: 'TeamOneScore',
                pointId: pointOneId,
            })

            const point1 = await Point.create({
                gameId,
                _id: pointOneId,
                pointNumber: 1,
                teamOneScore: 1,
                teamTwoScore: 0,
                pullingTeam: teamTwo,
                receivingTeam: teamOne,
                scoringTeam: teamOne,
                teamOneActive: false,
                teamTwoActive: false,
                teamOneStatus: PointStatus.COMPLETE,
                teamTwoStatus: PointStatus.COMPLETE,
                teamOneActions: [action11._id, action12._id, action13._id],
                teamTwoActions: [action21._id, action22._id],
            })

            const point2 = await Point.create({
                gameId,
                pointNumber: 2,
                teamOneScore: 1,
                teamTwoScore: 0,
                pullingTeam: teamTwo,
                receivingTeam: teamOne,
                scoringTeam: undefined,
                teamOneActive: true,
                teamTwoActive: true,
                teamOneStatus: PointStatus.ACTIVE,
                teamTwoStatus: PointStatus.ACTIVE,
                teamOneActions: [],
                teamTwoActions: [],
            })

            await saveRedisAction(
                client,
                { teamNumber: 'one', actionNumber: 1, actionType: ActionType.PULL, comments: [], tags: [] },
                point2._id.toHexString(),
            )

            await client.set(`${gameId}:${point2._id}:one:actions`, 1)

            await saveRedisAction(
                client,
                { teamNumber: 'two', actionNumber: 1, actionType: ActionType.CATCH, comments: [], tags: [] },
                point2._id.toHexString(),
            )

            await saveRedisAction(
                client,
                { teamNumber: 'two', actionNumber: 2, actionType: ActionType.CATCH, comments: [], tags: [] },
                point2._id.toHexString(),
            )

            await client.set(`${gameId}:${point2._id}:two:actions`, 2)

            await Game.create({
                _id: gameId,
                teamOne,
                teamTwo,
                teamTwoDefined: true,
                teamTwoActive: false,
                teamOneActive: false,
                teamOneStatus: GameStatus.COMPLETE,
                teamTwoStatus: GameStatus.COMPLETE,
                scoreLimit: 15,
                halfScore: 8,
                startTime: new Date(),
                softcapMins: 75,
                hardcapMins: 90,
                playersPerPoint: 7,
                timeoutPerHalf: 1,
                floaterTimeout: true,
                points: [point1._id, point2._id],
            })
        })

        it('reactivates for team one', async () => {
            const result = await reactivateGame(gameId.toHexString(), 'jwt', teamOne._id.toHexString())

            expect(result.team).toBe('one')

            const game = await Game.findById(result.game._id)
            expect(result.game).toMatchObject(game!.toJSON())
            expect(game?.teamOneActive).toBe(true)
            expect(game?.teamOneStatus).toBe(GameStatus.ACTIVE)
            expect(game?.teamTwoActive).toBe(false)
            expect(game?.teamTwoStatus).toBe(GameStatus.COMPLETE)

            const payload = jwt.verify(result.token, process.env.JWT_SECRET as string) as JwtPayload
            expect(payload.sub).toBe(game!._id.toString())
            expect(payload.team).toBe('one')

            const point = await Point.findOne({ pointNumber: 2 })
            expect(result.activePoint).toMatchObject(point!.toJSON())
            expect(point?.teamOneActive).toBe(true)

            const actions = await Promise.all([getRedisAction(client, point!._id.toHexString(), 1, 'one')])
            expect(result.actions).toMatchObject(actions)
        })

        it('reactivates for team two', async () => {
            const result = await reactivateGame(gameId.toHexString(), 'jwt', teamTwo._id.toHexString())

            expect(result.team).toBe('two')

            const game = await Game.findById(result.game._id)
            expect(result.game).toMatchObject(game!.toJSON())
            expect(game?.teamOneActive).toBe(false)
            expect(game?.teamOneStatus).toBe(GameStatus.COMPLETE)
            expect(game?.teamTwoActive).toBe(true)
            expect(game?.teamTwoStatus).toBe(GameStatus.ACTIVE)

            const payload = jwt.verify(result.token, process.env.JWT_SECRET as string) as JwtPayload
            expect(payload.sub).toBe(game!._id.toString())
            expect(payload.team).toBe('two')

            const point = await Point.findOne({ pointNumber: 2 })
            expect(result.activePoint).toMatchObject(point!.toJSON())
            expect(point?.teamTwoActive).toBe(true)

            const actions = await Promise.all([
                getRedisAction(client, point!._id.toHexString(), 1, 'two'),
                getRedisAction(client, point!._id.toHexString(), 2, 'two'),
            ])
            expect(result.actions).toMatchObject(actions)
        })

        it('reactivates game with last point inactive for team one', async () => {
            const point1 = await Point.findOne({ pointNumber: 1 })
            const game = await Game.create({
                teamOne,
                teamTwo,
                teamTwoDefined: true,
                teamTwoActive: false,
                teamOneActive: false,
                teamOneStatus: GameStatus.COMPLETE,
                teamTwoStatus: GameStatus.COMPLETE,
                scoreLimit: 15,
                halfScore: 8,
                startTime: new Date(),
                softcapMins: 75,
                hardcapMins: 90,
                playersPerPoint: 7,
                timeoutPerHalf: 1,
                floaterTimeout: true,
                points: [point1!._id],
            })

            const result = await reactivateGame(game._id.toHexString(), 'jwt', teamOne._id.toHexString())

            expect(result.team).toBe('one')

            expect(result.game).toMatchObject({
                ...game.toJSON(),
                teamOneActive: true,
                teamOneStatus: GameStatus.ACTIVE,
            })

            const payload = jwt.verify(result.token, process.env.JWT_SECRET as string) as JwtPayload
            expect(payload.sub).toBe(game._id.toString())
            expect(payload.team).toBe('one')

            const point = await Point.findOne({ pointNumber: 1 })
            expect(result.activePoint).toMatchObject(point!.toJSON())
            expect(point?.teamOneActive).toBe(true)

            const actions = await Promise.all([
                getRedisAction(client, point!._id.toHexString(), 1, 'one'),
                getRedisAction(client, point!._id.toHexString(), 2, 'one'),
                getRedisAction(client, point!._id.toHexString(), 3, 'one'),
            ])
            expect(result.actions).toMatchObject(actions)
        })

        it('reactivates game with last point inactive for team two', async () => {
            const point1 = await Point.findOne({ pointNumber: 1 })
            const game = await Game.create({
                teamOne,
                teamTwo,
                teamTwoDefined: true,
                teamTwoActive: false,
                teamOneActive: false,
                teamOneStatus: GameStatus.COMPLETE,
                teamTwoStatus: GameStatus.COMPLETE,
                scoreLimit: 15,
                halfScore: 8,
                startTime: new Date(),
                softcapMins: 75,
                hardcapMins: 90,
                playersPerPoint: 7,
                timeoutPerHalf: 1,
                floaterTimeout: true,
                points: [point1!._id],
            })

            const result = await reactivateGame(game._id.toHexString(), 'jwt', teamTwo._id.toHexString())

            expect(result.team).toBe('two')

            expect(result.game).toMatchObject({
                ...game.toJSON(),
                teamTwoActive: true,
                teamTwoStatus: GameStatus.ACTIVE,
            })

            const payload = jwt.verify(result.token, process.env.JWT_SECRET as string) as JwtPayload
            expect(payload.sub).toBe(game!._id.toString())
            expect(payload.team).toBe('two')

            const point = await Point.findOne({ pointNumber: 1 })
            expect(result.activePoint).toMatchObject(point!.toJSON())
            expect(point?.teamTwoActive).toBe(true)

            const actions = await Promise.all([
                getRedisAction(client, point!._id.toHexString(), 1, 'two'),
                getRedisAction(client, point!._id.toHexString(), 2, 'two'),
            ])
            expect(result.actions).toMatchObject(actions)
        })

        it('reactivates without any points', async () => {
            const game = await Game.create({
                teamOne,
                teamTwo,
                teamTwoDefined: true,
                teamTwoActive: false,
                teamOneActive: false,
                teamOneStatus: GameStatus.COMPLETE,
                teamTwoStatus: GameStatus.COMPLETE,
                scoreLimit: 15,
                halfScore: 8,
                startTime: new Date(),
                softcapMins: 75,
                hardcapMins: 90,
                playersPerPoint: 7,
                timeoutPerHalf: 1,
                floaterTimeout: true,
                points: [],
            })

            const result = await reactivateGame(game._id.toHexString(), 'jwt', teamOne._id.toHexString())

            expect(result.game).toMatchObject({
                ...game.toJSON(),
                teamOneActive: true,
                teamOneStatus: GameStatus.ACTIVE,
            })
            expect(result.team).toBe('one')
            expect(result.activePoint).toBeUndefined()
            expect(result.actions).toMatchObject([])

            const payload = jwt.verify(result.token, process.env.JWT_SECRET as string) as JwtPayload
            expect(payload.sub).toBe(game._id.toString())
            expect(payload.team).toBe('one')
        })
    })

    describe('finish', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let finish: any
        beforeAll(() => {
            finish = container.resolve('gameServiceV2').finish
        })

        it('finishes point and game', async () => {
            const game = await Game.create({ ...gameData, teamOneStatus: GameStatus.ACTIVE })
            const point = await Point.create({
                ...createPointData,
                gameId: game._id,
                pointNumber: 4,
                teamOneStatus: PointStatus.ACTIVE,
            })
            await client.set(`${game._id.toHexString()}:${point._id.toHexString()}:one:actions`, 1)
            await saveRedisAction(
                client,
                {
                    actionNumber: 1,
                    actionType: ActionType.TEAM_ONE_SCORE,
                    teamNumber: 'one',
                    comments: [],
                    tags: [],
                },
                point._id.toHexString(),
            )

            const result = await finish(game._id.toHexString(), TeamNumber.ONE)
            expect(result.teamOneStatus).toBe(GameStatus.COMPLETE)

            const pointRecord = await Point.findById(point._id)
            expect(pointRecord?.teamOneStatus).toBe(PointStatus.COMPLETE)
        })

        it('errors with unfound point', async () => {
            const game = await Game.create({ ...gameData, teamOneStatus: GameStatus.ACTIVE })

            await expect(finish(game._id.toHexString(), TeamNumber.ONE)).rejects.toThrow(Constants.UNABLE_TO_FIND_POINT)
        })
    })

    describe('full', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let full: any
        beforeAll(() => {
            full = container.resolve('gameServiceV2').full
        })

        const guestId = new Types.ObjectId()
        const guest: Player = {
            _id: guestId,
            firstName: 'Logan',
            lastName: 'Call',
            username: 'logan',
        }
        const anil: Player = {
            _id: new Types.ObjectId(),
            firstName: 'Anil',
            lastName: 'Driehuys',
            username: 'anil',
        }
        const team = {
            _id: new Types.ObjectId(),
            place: 'PGH',
            name: 'Tbirds',
            teamname: 'birds',
            seasonStart: new Date(),
            seasonEnd: new Date(),
        }

        const action1: ClientAction = {
            playerOne: user1,
            actionType: ActionType.PULL,
            tags: ['long'],
        }
        const pointOne: ClientPoint = {
            pointNumber: 1,
            teamOnePlayers: [],
            teamOneScore: 1,
            teamTwoScore: 0,
            pullingTeam: {
                name: 'Pulling',
            },
            receivingTeam: {
                name: 'Receiving',
            },
            scoringTeam: { name: 'Receiving' },
            actions: [action1],
        }

        it('completes successfully', async () => {
            jest.spyOn(UltmtUtils, 'authenticateManager').mockReturnValueOnce(Promise.resolve(user1))
            jest.spyOn(UltmtUtils, 'createGuest').mockReturnValueOnce(
                Promise.resolve({
                    _id: new Types.ObjectId(),
                    place: 'Place',
                    name: 'Name',
                    teamname: 'placename',
                    seasonStart: new Date(),
                    seasonEnd: new Date(),
                    players: [anil],
                }),
            )
            const gameData: CreateFullGame = {
                teamOne: team,
                teamOnePlayers: [
                    { ...user1, localGuest: false },
                    { ...guest, localGuest: true },
                ],
                points: [pointOne],
                teamOneScore: 2,
                teamTwoScore: 0,
                teamTwo: { name: 'Wind Chill' },
                teamTwoDefined: false,
                creator: user1,
                scoreLimit: 15,
                halfScore: 7,
                timeoutPerHalf: 1,
                floaterTimeout: false,
                startTime: new Date(),
                softcapMins: 30,
                hardcapMins: 45,
                playersPerPoint: 7,
            }
            const result = await full(gameData, 'jwt')
            expect(result.get(guestId.toHexString())).toMatchObject(anil)
        })
    })

    describe('reenter', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let reenter: any
        beforeAll(() => {
            reenter = container.resolve('gameServiceV2').reenter
            jest.spyOn(UltmtUtils, 'authenticateManager').mockReturnValueOnce(Promise.resolve(user1))
        })
        it('completes successfully', async () => {
            const game = await Game.create(gameData)
            const result = await reenter(game._id.toHexString(), 'userjwt', game.teamOne._id!.toHexString())
            expect(result.actions).toBeUndefined()
            expect(result.token.length).toBeGreaterThan(25)
            expect(result.game._id.toHexString()).toBe(game._id.toHexString())
            expect(result.point).toBeUndefined()
        })
    })
})
