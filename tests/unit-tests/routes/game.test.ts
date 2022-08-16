import * as Constants from '../../../src/utils/constants'
import app from '../../../src/app'
import request from 'supertest'
import Game from '../../../src/models/game'
import { setUpDatabase, tearDownDatabase, createData, gameData, getMock, resetDatabase } from '../../fixtures/setup-db'
import axios from 'axios'
import { Types } from 'mongoose'
import jwt from 'jsonwebtoken'

beforeAll(async () => {
    await setUpDatabase()
})

afterAll(async () => {
    await tearDownDatabase()
})

afterEach(async () => {
    await resetDatabase()
})

jest.spyOn(axios, 'get').mockImplementation(getMock)

describe('test /POST game', () => {
    it('with valid data', async () => {
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

describe('test /PUT game', () => {
    it('with valid data', async () => {
        const game = await Game.create(gameData)
        const response = await request(app)
            .put('/api/v1/game')
            .set('Authorization', `Bearer ${game.token}`)
            .send({
                gameData: { timeoutPerHalf: 10 },
            })
            .expect(200)

        const { game: gameResponse } = response.body
        expect(gameResponse._id).toBe(game._id.toString())
        expect(gameResponse.timeoutPerHalf).toBe(10)

        const gameRecord = await Game.findById(game._id)
        expect(gameRecord?._id.toString()).toBe(game._id.toString())
        expect(gameRecord?.timeoutPerHalf).toBe(10)
    })

    it('with unauthenticated', async () => {
        await Game.create(gameData)
        await request(app)
            .put('/api/v1/game')
            .set('Authorization', 'Bearer badjwt')
            .send({
                gameData: { timeoutPerHalf: 10 },
            })
            .expect(401)
    })

    it('with unfound team in passport', async () => {
        await Game.create(gameData)
        const token = jwt.sign({ subject: new Types.ObjectId(), iat: Date.now() }, process.env.JWT_SECRET as string)
        await request(app)
            .put('/api/v1/game')
            .set('Authorization', `Bearer ${token}`)
            .send({
                gameData: { timeoutPerHalf: 10 },
            })
            .expect(401)
    })

    it('with error', async () => {
        getMock.mockImplementationOnce(() => {
            return Promise.resolve({ ok: false, status: 400 })
        })
        const game = await Game.create(gameData)
        await request(app)
            .put('/api/v1/game')
            .set('Authorization', `Bearer ${game.token}`)
            .send({
                gameData: { timeoutPerHalf: 10, teamTwoResolved: true },
            })
            .expect(404)
    })
})
