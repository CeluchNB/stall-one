/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as Constants from '../../../../src/utils/constants'
import { close, setupApp } from '../../../../src/app'
import request from 'supertest'
import Game from '../../../../src/models/game'
import {
    gameData,
    resetDatabase,
    client,
    createData,
    createPointData,
    setUpDatabase,
    tearDownDatabase,
} from '../../../fixtures/setup-db'
import Point from '../../../../src/models/point'
import { Types } from 'mongoose'
import { Player, TeamNumber } from '../../../../src/types/ultmt'
import { ActionType, RedisAction } from '../../../../src/types/action'
import { getRedisAction, saveRedisAction } from '../../../../src/utils/redis'
import Action from '../../../../src/models/action'
import { Server } from 'http'
import { PointStatus } from '../../../../src/types/point'
import { GameStatus } from '../../../../src/types/game'

jest.mock('@google-cloud/tasks/build/src/v2')
jest.mock('../../../../src/background/v1/point', () => {
    return {
        finishPointQueue: {
            initialize: jest.fn(),
            close: jest.fn(),
            addFinishPointJob: jest.fn(),
        },
    }
})

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

describe('test POST first point route', () => {
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

        const pointRecord = await Point.findOne({ pointNumber: 1, gameId: game._id })
        expect(pointRecord?.pullingTeam._id?.toString()).toBe(game.teamOne._id?.toString())
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
            gameId: game._id,
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

describe('test PUT pulling team', () => {
    it('with valid data for team one', async () => {
        const game = await Game.create(gameData)
        const initialPoint = await Point.create({
            gameId: game._id,
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
            gameId: game._id,
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
            gameId: game._id,
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
            gameId: game._id,
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

describe('test PUT set players', () => {
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
            gameId: game._id,
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
            gameId: game._id,
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

describe('test PUT finish point', () => {
    it('with valid team one data', async () => {
        const game = await Game.create(createData)
        const point = await Point.create({ ...createPointData, gameId: game._id })
        point.teamTwoStatus = PointStatus.FUTURE
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
        expect(pointResponse.teamOneScore).toBe(1)
        expect(pointResponse.teamTwoScore).toBe(0)
        expect(pointResponse.teamOneStatus).toBe(PointStatus.COMPLETE)
        expect(pointResponse.teamTwoStatus).toBe(PointStatus.FUTURE)

        const pointRecord = await Point.findById(pointResponse._id)
        expect(pointRecord?.teamOneScore).toBe(1)
        expect(pointRecord?.teamTwoScore).toBe(0)
        expect(pointRecord?.teamOneStatus).toBe(PointStatus.COMPLETE)
        expect(pointRecord?.teamTwoStatus).toBe(PointStatus.FUTURE)

        const keys = await client.keys('*')
        expect(keys.length).toBe(11)
    })

    it('with service error', async () => {
        const game = await Game.create(createData)
        const point = await Point.create({ ...createPointData, gameId: game._id })
        point.teamTwoStatus = PointStatus.FUTURE
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
        const point = await Point.create({ ...createPointData, gameId: game._id })

        await request(app)
            .put(`/api/v1/point/${point._id.toString()}/finish`)
            .set('Authorization', 'Bearer badf345.asdf432gsf.1324asdf1')
            .send()
            .expect(401)
    })
})

describe('test PUT reactivate point', () => {
    const pointId = new Types.ObjectId()
    beforeEach(async () => {
        await Action.create({
            pointId,
            team: gameData.teamOne,
            actionNumber: 1,
            actionType: 'Pull',
            playerOne: { firstName: 'Name1', lastName: 'Last1' },
        })
        await Action.create({
            pointId,
            team: gameData.teamOne,
            actionNumber: 2,
            actionType: 'TeamTwoScore',
        })
        await Point.create({
            gameId: gameData._id,
            pointNumber: 1,
            teamOneActive: false,
            teamTwoActive: false,
            receivingTeam: {
                _id: new Types.ObjectId(),
                place: 'Place1',
                name: 'Name1',
                teamname: 'Place1Name1',
                seasonStart: new Date(),
                seasonEnd: new Date(),
            },
            pullingTeam: { place: 'Place2', name: 'Name2' },
            teamOneScore: 1,
            teamTwoScore: 0,
        })
        await Point.create({
            _id: pointId,
            gameId: gameData._id,
            pointNumber: 2,
            teamOneActive: false,
            teamTwoActive: false,
            pullingTeam: {
                _id: new Types.ObjectId(),
                place: 'Place1',
                name: 'Name1',
                teamname: 'Place1Name1',
                seasonStart: new Date(),
                seasonEnd: new Date(),
            },
            receivingTeam: { place: 'Place2', name: 'Name2' },
            teamOneScore: 1,
            teamTwoScore: 1,
        })

        await Game.create(gameData)
    })

    it('with valid use case', async () => {
        const game = await Game.findOne({})
        const initialPoint = await Point.findOne({ pointNumber: 2, gameId: game!._id })

        const token = game!.getToken('one')
        const response = await request(app)
            .put(`/api/v1/point/${initialPoint?._id.toString()}/reactivate`)
            .set('Authorization', `Bearer ${token}`)
            .send()
            .expect(200)

        const { point } = response.body

        expect(point.teamOneActive).toBe(true)
        expect(point.teamTwoActive).toBe(false)
        expect(point.teamOneStatus).toBe(PointStatus.ACTIVE)
        expect(point.teamTwoStatus).toBe(PointStatus.FUTURE)
        expect(point.teamOneScore).toBe(1)
        expect(point.teamTwoScore).toBe(0)
        const gameRecord = await Game.findById(game!._id)
        expect(gameRecord?.teamOneScore).toBe(1)
        expect(gameRecord?.teamTwoScore).toBe(0)

        const actions = await Action.find({})
        expect(actions.length).toBe(0)

        const actionCount = await client.get(`${game!._id}:${initialPoint!._id}:one:actions`)
        expect(actionCount).toBe('2')

        const actionOne = await getRedisAction(client, initialPoint!._id.toString(), 1, 'one')
        expect(actionOne.actionNumber).toBe(1)
        expect(actionOne.actionType).toBe('Pull')

        const actionTwo = await getRedisAction(client, initialPoint!._id.toString(), 2, 'one')
        expect(actionTwo.actionNumber).toBe(2)
        expect(actionTwo.actionType).toBe('TeamTwoScore')
    })

    it('with service error', async () => {
        const game = await Game.findOne({})

        const token = game!.getToken('one')
        const response = await request(app)
            .put(`/api/v1/point/${new Types.ObjectId().toString()}/reactivate`)
            .set('Authorization', `Bearer ${token}`)
            .send()
            .expect(404)
        expect(response.body.message).toBe(Constants.UNABLE_TO_FIND_POINT)
    })

    it('with bad token', async () => {
        await request(app)
            .put(`/api/v1/point/${new Types.ObjectId().toString()}/reactivate`)
            .set('Authorization', `Bearer basdf1234.asft423gad.45asdf3`)
            .send()
            .expect(401)
    })
})

describe('test DELETE point', () => {
    it('with valid data', async () => {
        const game = await Game.create(createData)
        const point = await Point.create({ ...createPointData, gameId: game._id })

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

        await client.set(`${game._id.toString()}:${point._id.toString()}:actions`, 5)
        const token = game.getToken('one')

        const response = await request(app)
            .delete(`/api/v1/point/${point._id.toString()}`)
            .set('Authorization', `Bearer ${token}`)
            .send()
            .expect(400)

        expect(response.body.message).toBe(Constants.INVALID_DATA)
    })
})

describe('test GET actions by point', () => {
    const team = {
        _id: new Types.ObjectId(),
        seasonStart: new Date(),
        seasonEnd: new Date(),
        place: 'Place 1',
        name: 'Name 1',
        teamname: 'placename',
    }
    const gameId = new Types.ObjectId()
    const pointId = new Types.ObjectId()
    beforeEach(async () => {
        const game = await Game.create({
            ...gameData,
            teamTwo: { _id: new Types.ObjectId(), name: 'Name2' },
            _id: gameId,
        })
        await Action.create({
            pointId,
            team: game.teamOne,
            actionNumber: 1,
            actionType: 'TeamOneScore',
        })
        await Action.create({
            pointId,
            team: game.teamOne,
            actionNumber: 1,
            actionType: 'Pull',
        })
        await Action.create({
            pointId,
            team: game.teamTwo,
            actionNumber: 2,
            actionType: 'TeamOneScore',
        })
    })

    it('with team one actions', async () => {
        const point = await Point.create({
            _id: pointId,
            gameId,
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: team,
            receivingTeam: { name: 'Team 2' },
            teamTwoActive: false,
        })

        const response = await request(app)
            .get(`/api/v1/point/${point._id.toString()}/actions?team=one`)
            .send()
            .expect(200)
        const { actions } = response.body
        expect(actions.length).toBe(2)
        expect(actions[0].actionNumber).toBe(1)
        expect(actions[0].actionType).toBe('TeamOneScore')

        expect(actions[1].actionNumber).toBe(1)
        expect(actions[1].actionType).toBe('Pull')
    })

    it('with team two actions', async () => {
        const point = await Point.create({
            _id: pointId,
            gameId,
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: team,
            receivingTeam: { name: 'Team 2' },
            teamTwoActive: false,
        })

        const response = await request(app)
            .get(`/api/v1/point/${point._id.toString()}/actions?team=two`)
            .send()
            .expect(200)

        const { actions } = response.body
        expect(actions.length).toBe(1)
        expect(actions[0].actionNumber).toBe(2)
        expect(actions[0].actionType).toBe('TeamOneScore')
    })

    it('with service error', async () => {
        const response = await request(app).get(`/api/v1/point/${new Types.ObjectId()}/actions`).send().expect(404)
        expect(response.body.message).toBe(Constants.UNABLE_TO_FIND_POINT)
    })
})

describe('test GET live actions of a point', () => {
    it('with valid response', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        point.teamTwoActive = true
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
            actionNumber: 1,
            actionType: ActionType.TEAM_ONE_SCORE,
            teamNumber: 'two',
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

        await client.set(`${game._id.toString()}:${point._id.toString()}:one:actions`, 1)
        await client.set(`${game._id.toString()}:${point._id.toString()}:two:actions`, 1)
        await client.set(`${game._id.toString()}:${point._id.toString()}:pulling`, 'one')
        await client.set(`${game._id.toString()}:${point._id.toString()}:receiving`, 'two')
        await saveRedisAction(client, action1, point._id.toString())
        await saveRedisAction(client, action2, point._id.toString())

        const response = await request(app)
            .get(`/api/v1/point/${point._id.toString()}/live/actions?gameId=${game._id.toString()}`)
            .send()
            .expect(200)

        const { actions } = response.body
        expect(actions.length).toBe(2)
        expect(actions[0].actionType).toBe(ActionType.CATCH)
        expect(actions[1].actionType).toBe(ActionType.TEAM_ONE_SCORE)
    })
})

describe('test PUT finish background point', () => {
    it('with successful call', async () => {
        const game = await Game.create(createData)
        const point = await Point.create({
            ...createPointData,
            gameId: game._id,
            teamOneStatus: PointStatus.COMPLETE,
            teamTwoStatus: PointStatus.COMPLETE,
        })
        game.teamTwoActive = false
        game.teamTwoDefined = false
        game.teamTwoStatus = GameStatus.GUEST
        game.points.push(point._id)
        await game.save()

        const firstAction: RedisAction = {
            actionNumber: 1,
            teamNumber: TeamNumber.ONE,
            actionType: ActionType.CATCH,
            tags: [],
            comments: [],
        }

        const secondAction: RedisAction = {
            actionNumber: 2,
            teamNumber: TeamNumber.ONE,
            actionType: ActionType.TEAM_ONE_SCORE,
            tags: [],
            comments: [],
        }
        await client.set(`${game._id.toString()}:${point._id.toString()}:pulling`, 'two')
        await client.set(`${game._id.toString()}:${point._id.toString()}:receiving`, 'one')
        await client.set(`${game._id.toString()}:${point._id.toString()}:one:actions`, 2)
        await client.set(`${game._id.toString()}:${point._id.toString()}:two:actions`, 0)
        await saveRedisAction(client, firstAction, point._id.toString())
        await saveRedisAction(client, secondAction, point._id.toString())

        await request(app)
            .put(`/api/v1/point/${point._id.toHexString()}/background-finish`)
            .send({
                finishPointData: {
                    gameId: game._id.toHexString(),
                    team: 'one',
                },
            })
            .expect(200)

        const pullingKey = await client.get(`${game._id.toString()}:${point._id.toString()}:pulling`)
        expect(pullingKey).toBeNull()

        const receivingKey = await client.get(`${game._id.toString()}:${point._id.toString()}:receiving`)
        expect(receivingKey).toBeNull()

        const teamOneActionCount = await client.get(`${game._id.toString()}:${point._id.toString()}:one:actions`)
        expect(teamOneActionCount).toBeNull()

        const teamTwoActiveCount = await client.get(`${game._id.toString()}:${point._id.toString()}:two:actions`)
        expect(teamTwoActiveCount).toBeNull()
    })

    it('with failed call', async () => {
        const id = new Types.ObjectId()
        await request(app)
            .put(`/api/v1/point/${id.toHexString()}/background-finish`)
            .send({
                finishPointData: {
                    gameId: id.toHexString(),
                    team: 'one',
                },
            })
            .expect(404)
    })
})
