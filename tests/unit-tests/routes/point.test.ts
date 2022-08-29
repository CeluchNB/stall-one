import * as Constants from '../../../src/utils/constants'
import app from '../../../src/app'
import request from 'supertest'
import Game from '../../../src/models/game'
import { setUpDatabase, tearDownDatabase, gameData, resetDatabase } from '../../fixtures/setup-db'
import Point from '../../../src/models/point'
import { Types } from 'mongoose'
import { Player } from '../../../src/types/ultmt'

beforeAll(async () => {
    await setUpDatabase()
})

afterAll(async () => {
    await tearDownDatabase()
})

afterEach(async () => {
    await resetDatabase()
})

describe('test /POST first point route', () => {
    it('with valid data', async () => {
        const game = await Game.create(gameData)

        const response = await request(app)
            .post('/api/v1/point/first?pulling=true')
            .set('Authorization', `Bearer ${game.teamOneToken}`)
            .send()
            .expect(200)

        const { point } = response.body
        expect(point.gameId.toString()).toBe(game._id.toString())
        expect(point.pullingTeam._id?.toString()).toBe(game.teamOne._id?.toString())

        const points = await Point.find({})
        expect(points.length).toBe(1)
        expect(points[0].gameId.toString()).toBe(game._id.toString())
        expect(points[0].pullingTeam._id?.toString()).toBe(game.teamOne._id?.toString())
    })

    it('with bad game authentication', async () => {
        await request(app)
            .post('/api/v1/point/first?pulling=true')
            .set('Authorization', 'Bearer asf134fsg.adsf43esgd.4312123')
            .send()
            .expect(401)
    })

    it('with invalid data', async () => {
        const game = await Game.create(gameData)
        await Point.create({
            gameId: game._id,
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: game.teamOne,
            receivingTeam: game.teamTwo,
        })

        const response = await request(app)
            .post('/api/v1/point/first?pulling=false')
            .set('Authorization', `Bearer ${game.teamOneToken}`)
            .send()
            .expect(400)

        expect(response.body.message).toBe(Constants.CONFLICTING_POSSESSION)
    })
})

describe('test /PUT set players', () => {
    it('with valid data', async () => {
        const game = await Game.create(gameData)
        const initialPoint = await Point.create({
            gameId: game._id,
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: game.teamOne,
            receivingTeam: game.teamTwo,
        })

        const players: Player[] = []
        for (let i = 0; i < 7; i++) {
            players.push({
                _id: new Types.ObjectId(),
                firstName: `First ${i}`,
                lastName: `Last ${i}`,
                username: `First${i}last${i}`,
            })
        }

        const response = await request(app)
            .put(`/api/v1/point/players/${initialPoint._id.toString()}`)
            .set('Authorization', `Bearer ${game.teamOneToken}`)
            .send({ players })
            .expect(200)

        const { point } = response.body
        expect(point._id.toString()).toBe(initialPoint._id.toString())
        expect(point.teamOnePlayers.length).toBe(7)
        expect(point.teamOnePlayers[6].username).toBe(players[6].username)

        const pointRecord = await Point.findById(point._id)
        expect(pointRecord?.teamOnePlayers.length).toBe(7)
        expect(pointRecord?.teamOnePlayers[6].username).toBe(players[6].username)
    })

    it('with bad token', async () => {
        const game = await Game.create(gameData)
        const initialPoint = await Point.create({
            gameId: game._id,
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: game.teamOne,
            receivingTeam: game.teamTwo,
        })

        const players: Player[] = []
        for (let i = 0; i < 7; i++) {
            players.push({
                _id: new Types.ObjectId(),
                firstName: `First ${i}`,
                lastName: `Last ${i}`,
                username: `First${i}last${i}`,
            })
        }

        await request(app)
            .put(`/api/v1/point/players/${initialPoint._id.toString()}`)
            .set('Authorization', 'Bearer asdf1234.afadsf43a.agsd34asd')
            .send({ players })
            .expect(401)
    })

    it('with player error', async () => {
        const game = await Game.create(gameData)
        const initialPoint = await Point.create({
            gameId: game._id,
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: game.teamOne,
            receivingTeam: game.teamTwo,
        })

        const players: Player[] = []
        for (let i = 0; i < 8; i++) {
            players.push({
                _id: new Types.ObjectId(),
                firstName: `First ${i}`,
                lastName: `Last ${i}`,
                username: `First${i}last${i}`,
            })
        }

        const response = await request(app)
            .put(`/api/v1/point/players/${initialPoint._id.toString()}`)
            .set('Authorization', `Bearer ${game.teamOneToken}`)
            .send({ players })
            .expect(400)

        expect(response.body.message).toBe(Constants.WRONG_NUMBER_OF_PLAYERS)
    })
})