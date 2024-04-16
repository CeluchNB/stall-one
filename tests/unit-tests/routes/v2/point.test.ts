import * as Constants from '../../../../src/utils/constants'
import { close, setupApp } from '../../../../src/app'
import request from 'supertest'
import Game from '../../../../src/models/game'
import { gameData, getMock, resetDatabase, setUpDatabase, tearDownDatabase } from '../../../fixtures/setup-db'
import axios from 'axios'
import { Server } from 'http'
import { PointStatus } from '../../../../src/types/point'

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

            expect(response.body.message).toBe(Constants.UNABLE_TO_FIND_POINT)
        })
    })
})
