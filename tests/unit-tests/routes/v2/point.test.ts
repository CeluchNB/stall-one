import * as Constants from '../../../../src/utils/constants'
import { close, setupApp } from '../../../../src/app'
import request from 'supertest'
import Game from '../../../../src/models/game'
import { gameData, getMock, resetDatabase, setUpDatabase, tearDownDatabase } from '../../../fixtures/setup-db'
import axios from 'axios'
import { Server } from 'http'
import { PointStatus } from '../../../../src/types/point'
import Action from '../../../../src/models/action'
import { ActionType } from '../../../../src/types/action'
import Point from '../../../../src/models/point'

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

describe('V2 Point API', () => {
    describe('POST /next', () => {
        it('handles success', async () => {
            const game = await Game.create(gameData)
            const token = game.getToken('one')
            const response = await request(app)
                .post(`/api/v2/point/next?pointNumber=0&pullingTeam=two`)
                .set('Authorization', `Bearer ${token}`)
                .send()
                .expect(201)

            const { point } = response.body
            expect(point).toMatchObject({
                pointNumber: 1,
                teamOneScore: 0,
                teamTwoScore: 0,
                teamOneStatus: PointStatus.ACTIVE,
                teamTwoStatus: PointStatus.FUTURE,
            })
        })

        it('handles error', async () => {
            const game = await Game.create(gameData)
            const token = game.getToken('one')
            const response = await request(app)
                .post(`/api/v2/point/next?pointNumber=3&pullingTeam=two`)
                .set('Authorization', `Bearer ${token}`)
                .send()
                .expect(404)

            expect(response.body.message).toBe(Constants.NO_PREVIOUS_POINT)
        })
    })

    describe('POST /back', () => {
        it('handles success', async () => {
            const game = await Game.create(gameData)
            const token = game.getToken('one')
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

            const response = await request(app)
                .put('/api/v2/point/back?pointNumber=4')
                .set('Authorization', `Bearer ${token}`)
                .send()
                .expect(200)

            const { point, actions } = response.body
            expect(point._id).toBe(prevPoint._id.toHexString())
            expect(point.pointNumber).toBe(3)
            expect(point.teamOneStatus).toBe(PointStatus.ACTIVE)
            expect(point.teamTwoStatus).toBe(PointStatus.ACTIVE)
            expect(actions.length).toBe(2)
        })

        it('handles error', async () => {
            const game = await Game.create(gameData)
            const token = game.getToken('one')

            const response = await request(app)
                .put('/api/v2/point/back?pointNumber=4')
                .set('Authorization', `Bearer ${token}`)
                .send()
                .expect(404)

            expect(response.body.message).toBe(Constants.UNABLE_TO_FIND_POINT)
        })
    })
})
