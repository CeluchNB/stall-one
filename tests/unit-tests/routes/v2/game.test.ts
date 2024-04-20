/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as Constants from '../../../../src/utils/constants'
import { Types } from 'mongoose'
import { close, setupApp } from '../../../../src/app'
import request from 'supertest'
import Action from '../../../../src/models/action'
import Game from '../../../../src/models/game'
import Point from '../../../../src/models/point'
import { ActionType } from '../../../../src/types/action'
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
import { GameStatus } from '../../../../src/types/game'
import { PointStatus } from '../../../../src/types/point'

jest.mock('@google-cloud/tasks/build/src/v2')

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
})
