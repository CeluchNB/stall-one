import * as Constants from '../../../src/utils/constants'
import app from '../../../src/app'
import request from 'supertest'
import Game from '../../../src/models/game'
import { setUpDatabase, tearDownDatabase, createData, fetchMock, resetDatabase } from '../../fixtures/setup-db'

beforeAll(async () => {
    await setUpDatabase()
})

afterAll(async () => {
    await tearDownDatabase()
})

afterEach(async () => {
    await resetDatabase()
})

describe('test /POST game', () => {
    afterEach(() => {
        fetchMock.mockClear()
    })

    it('with valid data', async () => {
        global.fetch = fetchMock
        const response = await request(app)
            .post('/api/v1/game')
            .set('Authorization', 'Bearer jwt')
            .send({
                createGameData: createData,
            })
            .expect(201)

        const { game, token } = response.body
        const gameRecord = await Game.findOne({})
        expect(game._id.toString()).toBe(gameRecord?._id.toString())
        expect(game.teamTwoResolved).toBe(false)
        expect(game.teamOnePlayers.length).toBe(2)
        expect(game.teamTwoPlayers.length).toBe(0)
        expect(game.token).toBeUndefined()
        expect(token.length).toBeGreaterThan(20)
        expect(gameRecord?.teamOnePlayers.length).toBe(2)
        expect(gameRecord?.teamTwoPlayers.length).toBe(0)
    })

    it('with invalid data', async () => {
        global.fetch = fetchMock
        const response = await request(app)
            .post('/api/v1/game')
            .set('Authorization', 'Bearer jwt')
            .send({
                createGameData: { randomKey: 'bad data' },
            })
            .expect(500)

        expect(response.body.message).toBe(Constants.GENERIC_ERROR)
    })
})
