import * as Constants from '../../../src/utils/constants'
import app from '../../../src/app'
import request from 'supertest'
import Game from '../../../src/models/game'
import { setUpDatabase, tearDownDatabase, gameData, resetDatabase } from '../../fixtures/setup-db'
import Point from '../../../src/models/point'

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
