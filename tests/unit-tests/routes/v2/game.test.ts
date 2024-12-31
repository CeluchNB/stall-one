/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as Constants from '../../../../src/utils/constants'
import * as UltmtUtils from '../../../../src/utils/ultmt'
import { Types } from 'mongoose'
import { close, setupApp } from '../../../../src/app'
import request from 'supertest'
import Action from '../../../../src/models/action'
import Game from '../../../../src/models/game'
import Point from '../../../../src/models/point'
import { ActionType, ClientAction } from '../../../../src/types/action'
import { saveRedisAction } from '../../../../src/utils/redis'
import {
    client,
    createPointData,
    gameData,
    getMock,
    resetDatabase,
    setUpDatabase,
    tearDownDatabase,
} from '../../../fixtures/setup-db'
import jwt, { JwtPayload } from 'jsonwebtoken'
import axios from 'axios'
import { Server } from 'http'
import { CreateFullGame, GameStatus } from '../../../../src/types/game'
import { ClientPoint, PointStatus } from '../../../../src/types/point'
import { Player } from '../../../../src/types/ultmt'

jest.mock('@google-cloud/tasks')

let app: Server
beforeAll(async () => {
    app = await setupApp()
    await setUpDatabase()
})

afterAll(async () => {
    await close()
    await tearDownDatabase()
})

afterEach(async () => {
    await resetDatabase()
})

beforeEach(() => {
    jest.spyOn(axios, 'get').mockImplementation(getMock)
})

afterEach(() => {
    jest.spyOn(axios, 'get').mockReset()
})

describe('Game Routes v2', () => {
    describe('PUT /game/:id/reactivate', () => {
        const teamOne = {
            _id: new Types.ObjectId(),
            name: 'Team One',
            place: 'Place One',
            teamname: 'team1',
        }

        const gameId = new Types.ObjectId()
        const pointOneId = new Types.ObjectId()
        const pointTwoId = new Types.ObjectId()
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

            const point1 = await Point.create({
                _id: pointOneId,
                gameId,
                pointNumber: 1,
                teamOneScore: 1,
                teamTwoScore: 0,
                pullingTeam: { name: 'Team 2' },
                receivingTeam: teamOne,
                scoringTeam: teamOne,
                teamOneActive: false,
                teamTwoActive: false,
                teamOneStatus: 'complete',
                teamTwoStatus: 'complete',
                teamOneActions: [action11._id, action12._id, action13._id],
                teamTwoActions: [],
            })

            const point2 = await Point.create({
                _id: pointTwoId,
                gameId,
                pointNumber: 2,
                teamOneScore: 1,
                teamTwoScore: 0,
                pullingTeam: { name: 'Team 2' },
                receivingTeam: teamOne,
                scoringTeam: undefined,
                teamOneActive: true,
                teamTwoActive: true,
                teamOneStatus: 'active',
                teamTwoStatus: 'active',
                teamOneActions: [],
                teamTwoActions: [],
            })

            await saveRedisAction(
                client,
                { teamNumber: 'one', actionNumber: 1, actionType: ActionType.PULL, comments: [], tags: [] },
                point2._id.toHexString(),
            )

            await client.set(`${gameId}:${point2._id}:one:actions`, 1)

            await Game.create({
                _id: gameId,
                teamOne,
                teamTwo: { name: 'Team 2' },
                teamTwoDefined: true,
                teamTwoActive: false,
                teamOneActive: false,
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
        it('with successful response', async () => {
            const response = await request(app)
                .put(`/api/v2/game/${gameId}/reactivate?team=${teamOne._id.toHexString()}`)
                .set('Authorization', 'Bearer token')
                .send()
                .expect(200)

            expect(response.body).toBeDefined()
            const { game, team, token, activePoint, actions } = response.body

            expect(game._id).toEqual(gameId.toHexString())
            expect(team).toBe('one')

            const payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload
            expect(payload.sub).toBe(game._id.toString())
            expect(payload.team).toBe('one')

            expect(activePoint._id.toString()).toBe(pointTwoId.toHexString())

            expect(actions.length).toBe(1)
        })

        it('with unsuccessful response', async () => {
            const response = await request(app)
                .put(`/api/v2/game/${gameId}/reactivate?team=${new Types.ObjectId().toHexString()}`)
                .set('Authorization', 'Bearer token')
                .send()
                .expect(404)

            expect(response.body.message).toBe(Constants.UNABLE_TO_FETCH_TEAM)
        })
    })

    describe('PUT /game/finish', () => {
        it('succeeds', async () => {
            const game = await Game.create({ ...gameData, teamOneStatus: GameStatus.ACTIVE })
            const token = game.getToken('one')
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

            const response = await request(app)
                .put('/api/v2/game/finish')
                .set('Authorization', `Bearer ${token}`)
                .send()
                .expect(200)

            const { game: gameResponse } = response.body
            expect(gameResponse.teamOneStatus).toBe(GameStatus.COMPLETE)
        })

        it('fails', async () => {
            const game = await Game.create({ ...gameData, teamOneStatus: GameStatus.ACTIVE })
            const token = game.getToken('one')

            const response = await request(app)
                .put('/api/v2/game/finish')
                .set('Authorization', `Bearer ${token}`)
                .send()
                .expect(404)
            expect(response.body.message).toBe(Constants.UNABLE_TO_FIND_POINT)
        })
    })

    describe('POST /game/full', () => {
        beforeEach(() => {
            jest.restoreAllMocks()
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
        const user1: Player = {
            _id: new Types.ObjectId(),
            firstName: 'Kenny',
            lastName: 'Furdella',
            username: 'kenny',
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

        it('handles success', async () => {
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

            const response = await request(app)
                .post('/api/v2/game/full')
                .set('Authorization', 'Bearer jwt')
                .send({ gameData })
                .expect(201)

            const { guests } = response.body
            expect(guests[guestId.toHexString()].username).toBe(anil.username)
        })

        it('handles failure', async () => {
            const gameData: CreateFullGame = {
                teamOne: { name: 'Tbirds' },
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

            const response = await request(app)
                .post('/api/v2/game/full')
                .set('Authorization', 'Bearer jwt')
                .send({ gameData })
                .expect(404)

            expect(response.body.message).toBe(Constants.UNABLE_TO_FETCH_TEAM)
        })
    })

    describe('PUT /game/:id/reenter', () => {
        const user1: Player = {
            _id: new Types.ObjectId(),
            firstName: 'Kenny',
            lastName: 'Furdella',
            username: 'kenny',
        }
        beforeAll(() => {
            jest.spyOn(UltmtUtils, 'authenticateManager').mockReturnValueOnce(Promise.resolve(user1))
        })

        it('handles success', async () => {
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

            const response = await request(app)
                .put(`/api/v2/game/${game._id.toHexString()}/reenter`)
                .set('Authorization', `Bearer userjwt`)
                .send({ teamId: game.teamOne._id })
                .expect(200)

            const { game: responseGame, token, point: responsePoint, actions } = response.body
            expect(responseGame._id).toBe(game._id.toHexString())
            expect(token.length).toBeGreaterThan(25)
            expect(responsePoint._id).toBe(point._id.toHexString())
            expect(actions.length).toBe(0)
        })

        it('handles errors', async () => {
            const response = await request(app)
                .put(`/api/v2/game/${new Types.ObjectId().toHexString()}/reenter`)
                .set('Authorization', `Bearer userjwt`)
                .send({ teamId: new Types.ObjectId() })
                .expect(404)

            expect(response.body.message).toBe(Constants.UNABLE_TO_FIND_GAME)
        })
    })
})
