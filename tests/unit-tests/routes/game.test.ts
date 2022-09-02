import * as Constants from '../../../src/utils/constants'
import app, { close } from '../../../src/app'
import request from 'supertest'
import Game from '../../../src/models/game'
import { createData, gameData, getMock, resetDatabase } from '../../fixtures/setup-db'
import axios from 'axios'
import { Types } from 'mongoose'
import jwt from 'jsonwebtoken'

afterAll(async () => {
    await close()
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
        expect(game.teamTwoDefined).toBe(false)
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
            .set('Authorization', `Bearer ${game.teamOneToken}`)
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
        const token = jwt.sign(
            { sub: new Types.ObjectId(), iat: Date.now(), team: 'one' },
            process.env.JWT_SECRET as string,
        )
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
            .set('Authorization', `Bearer ${game.teamOneToken}`)
            .send({
                gameData: { timeoutPerHalf: 10, teamTwoDefined: true },
            })
            .expect(404)
    })
})

describe('test /PUT game join', () => {
    it('with valid data', async () => {
        const initialGame = await Game.create(gameData)
        initialGame.teamTwo = {
            _id: new Types.ObjectId(),
            place: 'Place 2',
            name: 'Name 2',
            teamname: 'place2name2',
        }
        await initialGame.save()

        const response = await request(app)
            .put(
                `/api/v1/game/resolve/${initialGame._id}?team=${initialGame.teamTwo._id}&otp=${initialGame.resolveCode}`,
            )
            .set('Authorization', 'Bearer fake.adf345.jwt')
            .send()
            .expect(200)

        const { game, token } = response.body
        expect(game._id.toString()).toBe(initialGame._id.toString())
        const gameRecord = await Game.findById(game._id)
        expect(token).toBe(gameRecord?.teamTwoToken)
        expect(gameRecord?.teamTwoResolved).toBe(true)
    })

    it('with unfound game', async () => {
        const initialGame = await Game.create(gameData)
        initialGame.teamTwo = {
            _id: new Types.ObjectId(),
            place: 'Place 2',
            name: 'Name 2',
            teamname: 'place2name2',
        }
        await initialGame.save()

        const response = await request(app)
            .put(
                `/api/v1/game/resolve/${new Types.ObjectId()}?team=${initialGame.teamTwo._id}&otp=${
                    initialGame.resolveCode
                }`,
            )
            .set('Authorization', 'Bearer fake.adf345.jwt')
            .send()
            .expect(404)

        const { message } = response.body
        expect(message).toBe(Constants.UNABLE_TO_FIND_GAME)
    })
})

describe('test /PUT add guest player', () => {
    it('with valid data', async () => {
        const game = await Game.create(gameData)

        const response = await request(app)
            .put('/api/v1/game/player/guest')
            .set('Authorization', `Bearer ${game.teamOneToken}`)
            .send({
                player: {
                    firstName: 'Noah',
                    lastName: 'Celuch',
                },
            })
            .expect(200)

        const { game: gameResponse } = response.body
        expect(gameResponse.teamOnePlayers.length).toBe(1)
        expect(gameResponse.teamOnePlayers[0]).toEqual({ firstName: 'Noah', lastName: 'Celuch', username: 'guest' })
    })

    it('with bad token', async () => {
        await request(app)
            .put('/api/v1/game/player/guest')
            .set('Authorization', `Bearer basdf1234.tokenasd45.asdfas`)
            .send({
                player: {
                    firstName: 'Noah',
                    lastName: 'Celuch',
                },
            })
            .expect(401)
    })

    it('with game error', async () => {
        const game = await Game.create(gameData)
        const token = jwt.sign({ sub: game._id, iat: Date.now(), team: 'three' }, process.env.JWT_SECRET as string)
        const response = await request(app)
            .put('/api/v1/game/player/guest')
            .set('Authorization', `Bearer ${token}`)
            .send({
                player: {
                    firstName: 'Noah',
                    lastName: 'Celuch',
                },
            })
            .expect(400)

        expect(response.body.message).toBe(Constants.UNABLE_TO_ADD_PLAYER)
    })
})
