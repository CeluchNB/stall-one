import * as Constants from '../../../src/utils/constants'
import app, { close } from '../../../src/app'
import request from 'supertest'
import Game from '../../../src/models/game'
import {
    gameData,
    resetDatabase,
    client,
    createData,
    createPointData,
    setUpDatabase,
    tearDownDatabase,
} from '../../fixtures/setup-db'
import Point from '../../../src/models/point'
import { Types } from 'mongoose'
import { Player } from '../../../src/types/ultmt'
import { ActionType, RedisAction } from '../../../src/types/action'
import { saveRedisAction } from '../../../src/utils/redis'

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

describe('test /POST first point route', () => {
    it('with valid data', async () => {
        const game = await Game.create(gameData)
        const token = game.getToken('one')

        const response = await request(app)
            .post('/api/v1/point?pulling=true&number=1')
            .set('Authorization', `Bearer ${token}`)
            .send()
            .expect(200)

        const { point } = response.body
        expect(point.pullingTeam._id?.toString()).toBe(game.teamOne._id?.toString())

        const points = await Point.find({})
        expect(points.length).toBe(1)
        expect(points[0].pullingTeam._id?.toString()).toBe(game.teamOne._id?.toString())
        const gameRecord = await Game.findById(game._id)
        expect(gameRecord?.points.length).toBe(1)
        expect(gameRecord?.points[0].toString()).toBe(point._id.toString())
    })

    it('with bad game authentication', async () => {
        await request(app)
            .post('/api/v1/point?pulling=true&number=1')
            .set('Authorization', 'Bearer asf134fsg.adsf43esgd.4312123')
            .send()
            .expect(401)
    })

    it('with invalid data', async () => {
        const game = await Game.create(gameData)
        const point = await Point.create({
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: game.teamOne,
            receivingTeam: game.teamTwo,
        })
        game.points.push(point._id)
        await game.save()
        const token = game.getToken('one')

        const response = await request(app)
            .post('/api/v1/point?pulling=false&number=1')
            .set('Authorization', `Bearer ${token}`)
            .send()
            .expect(400)

        expect(response.body.message).toBe(Constants.CONFLICTING_POSSESSION)
    })
})

describe('test /PUT pulling team', () => {
    it('with valid data for team one', async () => {
        const game = await Game.create(gameData)
        const initialPoint = await Point.create({
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: game.teamTwo,
            receivingTeam: game.teamOne,
        })
        game.points.push(initialPoint._id)
        await game.save()
        const token = game.getToken('one')

        const response = await request(app)
            .put(`/api/v1/point/${initialPoint._id.toString()}/pulling?team=one`)
            .set('Authorization', `Bearer ${token}`)
            .send()
            .expect(200)

        const { point } = response.body
        expect(point.pullingTeam.name).toBe(game.teamOne.name)
        expect(point.receivingTeam.name).toBe(game.teamTwo.name)

        const pointRecord = await Point.findById(initialPoint._id)
        expect(pointRecord?.pullingTeam.name).toBe(game.teamOne.name)
        expect(pointRecord?.receivingTeam.name).toBe(game.teamTwo.name)
    })

    it('with valid data for team two', async () => {
        const game = await Game.create(gameData)
        const initialPoint = await Point.create({
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: game.teamOne,
            receivingTeam: game.teamTwo,
        })
        game.points.push(initialPoint._id)
        await game.save()
        const token = game.getToken('one')

        const response = await request(app)
            .put(`/api/v1/point/${initialPoint._id.toString()}/pulling?team=two`)
            .set('Authorization', `Bearer ${token}`)
            .send()
            .expect(200)

        const { point } = response.body
        expect(point.pullingTeam.name).toBe(game.teamTwo.name)
        expect(point.receivingTeam.name).toBe(game.teamOne.name)

        const pointRecord = await Point.findById(initialPoint._id)
        expect(pointRecord?.pullingTeam.name).toBe(game.teamTwo.name)
        expect(pointRecord?.receivingTeam.name).toBe(game.teamOne.name)
    })

    it('with invalid team value', async () => {
        const game = await Game.create(gameData)
        const initialPoint = await Point.create({
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: game.teamOne,
            receivingTeam: game.teamTwo,
        })
        game.points.push(initialPoint._id)
        await game.save()
        const token = game.getToken('one')

        const response = await request(app)
            .put(`/api/v1/point/${initialPoint._id.toString()}/pulling?team=three`)
            .set('Authorization', `Bearer ${token}`)
            .send()
            .expect(500)

        expect(response.body.message).toBe(Constants.GENERIC_ERROR)
    })

    it('with bad authentication', async () => {
        const game = await Game.create(gameData)
        const initialPoint = await Point.create({
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: game.teamOne,
            receivingTeam: game.teamTwo,
        })
        game.points.push(initialPoint._id)
        await game.save()

        await request(app)
            .put(`/api/v1/point/${initialPoint._id.toString()}/pulling?team=three`)
            .set('Authorization', `Bearer badsf2345.adsf435rrsga.4354esdf43`)
            .send()
            .expect(401)
    })
})

describe('test /PUT set players', () => {
    it('with valid data', async () => {
        const game = await Game.create(gameData)
        const initialPoint = await Point.create({
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: game.teamOne,
            receivingTeam: game.teamTwo,
        })
        game.points.push(initialPoint._id)
        await game.save()

        const players: Player[] = []
        for (let i = 0; i < 7; i++) {
            players.push({
                _id: new Types.ObjectId(),
                firstName: `First ${i}`,
                lastName: `Last ${i}`,
                username: `First${i}last${i}`,
            })
        }
        const token = game.getToken('one')

        const response = await request(app)
            .put(`/api/v1/point/${initialPoint._id.toString()}/players`)
            .set('Authorization', `Bearer ${token}`)
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
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: game.teamOne,
            receivingTeam: game.teamTwo,
        })
        game.points.push(initialPoint._id)
        await game.save()

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
            .put(`/api/v1/point/${initialPoint._id.toString()}/players`)
            .set('Authorization', 'Bearer asdf1234.afadsf43a.agsd34asd')
            .send({ players })
            .expect(401)
    })

    it('with player error', async () => {
        const game = await Game.create(gameData)
        const initialPoint = await Point.create({
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: game.teamOne,
            receivingTeam: game.teamTwo,
        })
        game.points.push(initialPoint._id)
        await game.save()

        const players: Player[] = []
        for (let i = 0; i < 8; i++) {
            players.push({
                _id: new Types.ObjectId(),
                firstName: `First ${i}`,
                lastName: `Last ${i}`,
                username: `First${i}last${i}`,
            })
        }
        const token = game.getToken('one')

        const response = await request(app)
            .put(`/api/v1/point/${initialPoint._id.toString()}/players`)
            .set('Authorization', `Bearer ${token}`)
            .send({ players })
            .expect(400)

        expect(response.body.message).toBe(Constants.WRONG_NUMBER_OF_PLAYERS)
    })
})

describe('test /PUT finish point', () => {
    it('with valid team one data', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        point.teamTwoActive = false
        game.points.push(point._id)
        await game.save()
        await point.save()

        const action1: RedisAction = {
            actionNumber: 1,
            actionType: ActionType.CATCH,
            teamNumber: 'one',
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            playerTwo: {
                _id: new Types.ObjectId(),
                firstName: 'Connor',
                lastName: 'Tipping',
                username: 'connor',
            },
            comments: [],
            tags: ['Huck'],
        }

        const action2: RedisAction = {
            actionNumber: 2,
            actionType: ActionType.TEAM_ONE_SCORE,
            teamNumber: 'one',
            playerTwo: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Connor',
                lastName: 'Tipping',
                username: 'connor',
            },
            comments: [],
            tags: ['Break'],
        }

        await client.set(`${game._id.toString()}:${point._id.toString()}:one:actions`, 2)
        await client.set(`${game._id.toString()}:${point._id.toString()}:pulling`, 'one')
        await client.set(`${game._id.toString()}:${point._id.toString()}:receiving`, 'two')
        await saveRedisAction(client, action1, point._id.toString())
        await saveRedisAction(client, action2, point._id.toString())

        const token = game.getToken('one')

        const response = await request(app)
            .put(`/api/v1/point/${point._id.toString()}/finish`)
            .set('Authorization', `Bearer ${token}`)
            .send()
            .expect(200)

        const { point: pointResponse } = response.body
        expect(pointResponse._id.toString()).toBe(point._id.toString())
        expect(pointResponse.teamOneActions.length).toBe(2)
        expect(pointResponse.teamOneScore).toBe(1)
        expect(pointResponse.teamTwoScore).toBe(0)
        expect(pointResponse.teamOneActive).toBe(false)
        expect(pointResponse.teamTwoActive).toBe(false)

        const pointRecord = await Point.findById(pointResponse._id)
        expect(pointRecord?.teamOneScore).toBe(1)
        expect(pointRecord?.teamTwoScore).toBe(0)
        expect(pointRecord?.teamOneActive).toBe(false)
        expect(pointRecord?.teamTwoActive).toBe(false)

        const keys = await client.keys('*')
        expect(keys.length).toBe(0)
    })

    it('with service error', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        point.teamTwoActive = false
        game.points.push(point._id)
        await game.save()
        await point.save()

        const token = game.getToken('one')

        const response = await request(app)
            .put(`/api/v1/point/${new Types.ObjectId()}/finish`)
            .set('Authorization', `Bearer ${token}`)
            .send()
            .expect(404)
        expect(response.body.message).toBe(Constants.UNABLE_TO_FIND_POINT)
    })

    it('with bad authentication', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        point.teamTwoActive = false
        game.points.push(point._id)
        await game.save()
        await point.save()

        await request(app)
            .put(`/api/v1/point/${point._id.toString()}/finish`)
            .set('Authorization', 'Bearer badf345.asdf432gsf.1324asdf1')
            .send()
            .expect(401)
    })
})

describe('test /DELETE point', () => {
    it('with valid data', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()

        await client.set(`${game._id.toString()}:${point._id.toString()}:one:actions`, 0)
        const token = game.getToken('one')

        await request(app)
            .delete(`/api/v1/point/${point._id.toString()}`)
            .set('Authorization', `Bearer ${token}`)
            .send()
            .expect(200)

        const pointRecord = await Point.findOne({})
        expect(pointRecord).toBeNull()
        const gameRecord = await Game.findOne({})
        expect(gameRecord?.points.length).toBe(0)

        const totalActions = await client.get(`${game._id.toString()}:${point._id.toString()}:one:actions`)
        expect(totalActions).toBeNull()
    })

    it('with bad token', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()

        await client.set(`${game._id.toString()}:${point._id.toString()}:actions`, 5)

        await request(app)
            .delete(`/api/v1/point/${point._id.toString()}`)
            .set('Authorization', `Bearer bad.ar43efwsdaf4rt.token1324radsf`)
            .send()
            .expect(401)
    })

    it('with service error', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()
        point.teamOneActions.push(new Types.ObjectId())
        await point.save()

        await client.set(`${game._id.toString()}:${point._id.toString()}:actions`, 5)
        const token = game.getToken('one')

        const response = await request(app)
            .delete(`/api/v1/point/${point._id.toString()}`)
            .set('Authorization', `Bearer ${token}`)
            .send()
            .expect(400)

        expect(response.body.message).toBe(Constants.MODIFY_LIVE_POINT_ERROR)
    })
})
