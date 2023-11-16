/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Types } from 'mongoose'
import app, { close } from '../../../../src/app'
import request from 'supertest'
import Action from '../../../../src/models/action'
import Game from '../../../../src/models/game'
import Point from '../../../../src/models/point'
import { ActionType } from '../../../../src/types/action'
import { saveRedisAction } from '../../../../src/utils/redis'
import { client, getMock, resetDatabase, setUpDatabase, tearDownDatabase } from '../../../fixtures/setup-db'
import axios from 'axios'

beforeAll(async () => {
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
        beforeEach(async () => {
            const action11 = await Action.create({
                team: teamOne,
                actionNumber: 1,
                actionType: 'Catch',
            })
            const action12 = await Action.create({
                team: teamOne,
                actionNumber: 2,
                actionType: 'Catch',
            })
            const action13 = await Action.create({
                team: teamOne,
                actionNumber: 3,
                actionType: 'TeamOneScore',
            })

            const point1 = await Point.create({
                pointNumber: 1,
                teamOneScore: 1,
                teamTwoScore: 0,
                pullingTeam: { name: 'Team 2' },
                receivingTeam: teamOne,
                scoringTeam: teamOne,
                teamOneActive: false,
                teamTwoActive: false,
                teamOneActions: [action11._id, action12._id, action13._id],
                teamTwoActions: [],
            })

            const point2 = await Point.create({
                pointNumber: 2,
                teamOneScore: 1,
                teamTwoScore: 0,
                pullingTeam: { name: 'Team 2' },
                receivingTeam: teamOne,
                scoringTeam: undefined,
                teamOneActive: true,
                teamTwoActive: true,
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
            const { result } = response.body

            const gameRecord = await Game.findOne({})
            expect(result.game._id).toBe(gameRecord!._id.toHexString())
            expect(result.game.points).toMatchObject(gameRecord!.points)
            expect(result.points.length).toBe(2)
            expect(result.points[0].actions.length).toBe(3)
            expect(result.points[1].actions.length).toBe(1)
        })

        // it('with unsuccessful response', async () => {})
    })
})
