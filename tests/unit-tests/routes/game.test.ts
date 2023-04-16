import * as Constants from '../../../src/utils/constants'
import app, { close } from '../../../src/app'
import request from 'supertest'
import Game from '../../../src/models/game'
import { createData, gameData, getMock, resetDatabase } from '../../fixtures/setup-db'
import axios from 'axios'
import { Types } from 'mongoose'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { ApiError } from '../../../src/types/errors'
import { Team } from '../../../src/types/ultmt'
import Action from '../../../src/models/action'
import Point from '../../../src/models/point'
import { CreateFullGame } from '../../../src/types/game'
import { ActionType } from '../../../src/types/action'

jest.mock('@google-cloud/tasks/build/src/v2')

afterAll(async () => {
    await close()
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

describe('test /PUT update game', () => {
    it('with valid data', async () => {
        const game = await Game.create(gameData)
        const token = game.getToken('one')

        const response = await request(app)
            .put('/api/v1/game')
            .set('Authorization', `Bearer ${token}`)
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
            .expect(404)
    })

    it('with error', async () => {
        const game = await Game.create(gameData)
        const token = game.getToken('one')
        await request(app)
            .put('/api/v1/game')
            .set('Authorization', `Bearer ${token}`)
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
                `/api/v1/game/${initialGame._id}/resolve?team=${initialGame.teamTwo._id}&otp=${initialGame.resolveCode}`,
            )
            .set('Authorization', 'Bearer fake.adf345.jwt')
            .send()
            .expect(200)

        const { game, token } = response.body
        expect(game._id.toString()).toBe(initialGame._id.toString())
        const payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload
        expect(payload.sub).toBe(game._id.toString())
        expect(payload.team).toBe('two')
        expect(payload.exp).toBe(Math.floor(new Date().getTime() / 1000) + 60 * 60 * 3)
        const gameRecord = await Game.findById(game._id)
        expect(gameRecord?.teamTwoActive).toBe(true)
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
                `/api/v1/game/${new Types.ObjectId()}/resolve?team=${initialGame.teamTwo._id}&otp=${
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
        const token = game.getToken('one')

        const response = await request(app)
            .put('/api/v1/game/player/guest')
            .set('Authorization', `Bearer ${token}`)
            .send({
                player: {
                    firstName: 'Noah',
                    lastName: 'Celuch',
                },
            })
            .expect(200)

        const { game: gameResponse } = response.body
        expect(gameResponse.teamOnePlayers.length).toBe(1)
        expect(gameResponse.teamOnePlayers[0]).toMatchObject({
            firstName: 'Noah',
            lastName: 'Celuch',
            username: 'guest',
        })
        expect(gameResponse.teamOnePlayers[0]._id).toBeDefined()
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

describe('test /PUT finish game', () => {
    it('with valid data for single team', async () => {
        const game = await Game.create(createData)
        const token = game.getToken('one')

        const response = await request(app)
            .put('/api/v1/game/finish')
            .set('Authorization', `Bearer ${token}`)
            .send()
            .expect(200)

        const { game: gameResponse } = response.body
        expect(gameResponse._id.toString()).toBe(game._id.toString())
        expect(gameResponse.teamOneActive).toBe(false)
        expect(gameResponse.teamTwoActive).toBe(false)
    })

    it('with bad token', async () => {
        await Game.create(createData)

        await request(app)
            .put('/api/v1/game/finish')
            .set('Authorization', 'Bearer adsf43.sdfaiu4323f.adgoai832rjka')
            .send()
            .expect(401)
    })

    it('with service error', async () => {
        jest.spyOn(Game.prototype, 'save').mockImplementationOnce(() => {
            throw new ApiError(Constants.UNABLE_TO_FIND_GAME, 404)
        })

        const game = await Game.create(createData)
        const token = game.getToken('one')

        const response = await request(app)
            .put('/api/v1/game/finish')
            .set('Authorization', `Bearer ${token}`)
            .send()
            .expect(404)

        expect(response.body.message).toBe(Constants.UNABLE_TO_FIND_GAME)
    })
})

describe('test /PUT reactivate game', () => {
    it('with valid data', async () => {
        const initGame = await Game.create(createData)
        initGame.teamOneActive = false
        await initGame.save()

        const response = await request(app)
            .put(`/api/v1/game/${initGame._id.toString()}/reactivate?team=${initGame.teamOne._id?.toString()}`)
            .set('Authorization', 'Bearer token')
            .send()
            .expect(200)

        const { game, token } = response.body
        expect(game.teamOneActive).toBe(true)

        const payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload
        expect(payload.sub).toBe(initGame._id.toString())
        expect(payload.team).toBe('one')
        expect(payload.exp).toBe(Math.floor(new Date().getTime() / 1000) + 60 * 60 * 3)
    })

    it('with service error', async () => {
        const response = await request(app)
            .put(`/api/v1/game/${new Types.ObjectId().toString()}/reactivate?team=team1`)
            .set('Authorization', 'Bearer token')
            .send()
            .expect(404)

        expect(response.body.message).toBe(Constants.UNABLE_TO_FIND_GAME)
    })
})

describe('test /DELETE game', () => {
    const team: Team = {
        _id: new Types.ObjectId(),
        seasonStart: new Date(),
        seasonEnd: new Date(),
        place: 'Place 1',
        name: 'Name 1',
        teamname: 'placename',
    }
    beforeEach(async () => {
        const action1 = await Action.create({
            team,
            actionNumber: 1,
            actionType: 'TeamOneScore',
        })
        const action2 = await Action.create({
            team,
            actionNumber: 1,
            actionType: 'Pull',
        })
        const action3 = await Action.create({
            team,
            actionNumber: 2,
            actionType: 'TeamOneScore',
        })
        await Point.create({
            pointNumber: 1,
            teamOneScore: 1,
            teamTwoScore: 0,
            pullingTeam: { name: 'Name 2' },
            receivingTeam: team,
            scoringTeam: team,
            teamOneActive: false,
            teamTwoActive: false,
            teamOneActions: [action1._id],
        })
        await Point.create({
            pointNumber: 2,
            teamOneScore: 2,
            teamTwoScore: 0,
            pullingTeam: team,
            receivingTeam: { name: 'Name 2' },
            scoringTeam: team,
            teamOneActive: false,
            teamTwoActive: false,
            teamOneActions: [action2._id, action3._id],
        })
        const [point1, point2] = await Point.find({})
        await Game.create({
            teamOne: team,
            teamTwo: { name: 'Name 2' },
            teamTwoDefined: false,
            scoreLimit: 15,
            halfScore: 8,
            startTime: new Date(),
            softcapMins: 75,
            hardcapMins: 90,
            playersPerPoint: 7,
            timeoutPerHalf: 1,
            floaterTimeout: true,
            creator: {
                _id: new Types.ObjectId(),
                firstName: 'First1',
                lastName: 'Last1',
                username: 'first1last1',
            },
            points: [point1._id, point2._id],
        })
    })

    it('with valid data', async () => {
        const [game] = await Game.find({})

        await request(app)
            .delete(`/api/v1/game/${game._id.toString()}?team=${team._id?.toString()}`)
            .set('Authorization', 'Bearer jwt')
            .send()
            .expect(200)

        const actions = await Action.find({})
        expect(actions.length).toBe(0)

        const points = await Point.find({})
        expect(points.length).toBe(0)

        const games = await Game.find({})
        expect(games.length).toBe(0)
    })

    it('with service error', async () => {
        await request(app)
            .delete(`/api/v1/game/${new Types.ObjectId()}?team=${team._id?.toString()}`)
            .set('Authorization', 'Bearer jwt')
            .send()
            .expect(404)

        const actions = await Action.find({})
        expect(actions.length).toBe(3)

        const points = await Point.find({})
        expect(points.length).toBe(2)

        const games = await Game.find({})
        expect(games.length).toBe(1)
    })
})

describe('test /GET game', () => {
    it('with found game', async () => {
        const initGame = await Game.create(gameData)

        const response = await request(app).get(`/api/v1/game/${initGame._id.toString()}`).send().expect(200)
        const { game } = response.body

        expect(game._id.toString()).toBe(initGame._id.toString())
        expect(game.creator.username).toBe(initGame.creator.username)
        expect(game.floaterTimeout).toBe(initGame.floaterTimeout)
        expect(game.halfScore).toBe(initGame.halfScore)
        expect(game.softcapMins).toBe(initGame.softcapMins)
        expect(game.hardcapMins).toBe(initGame.hardcapMins)
        expect(game.playersPerPoint).toBe(initGame.playersPerPoint)
        expect(game.timeoutPerHalf).toBe(initGame.timeoutPerHalf)
        expect(game.teamOneScore).toBe(initGame.teamOneScore)
        expect(game.teamTwoScore).toBe(initGame.teamTwoScore)
        expect(game.teamOneActive).toBe(initGame.teamOneActive)
        expect(game.teamTwoActive).toBe(initGame.teamTwoActive)
    })

    it('with unfound game', async () => {
        const response = await request(app).get(`/api/v1/game/${new Types.ObjectId().toString()}`).send().expect(404)
        expect(response.body.message).toBe(Constants.UNABLE_TO_FIND_GAME)
    })
})

describe('test /GET game points', () => {
    it('with found points', async () => {
        const point1 = await Point.create({
            pointNumber: 1,
            pullingTeam: { name: 'Team 1' },
            receivingTeam: { name: 'Team 2' },
            teamOneScore: 0,
            teamTwoScore: 1,
        })
        const point2 = await Point.create({
            pointNumber: 2,
            pullingTeam: { name: 'Team 2' },
            receivingTeam: { name: 'Team 1' },
            teamOneScore: 1,
            teamTwoScore: 1,
        })
        await Point.create({
            pointNumber: 3,
            pullingTeam: { name: 'Team 1' },
            receivingTeam: { name: 'Team 2' },
            teamOneScore: 1,
            teamTwoScore: 2,
        })
        const game = await Game.create(createData)

        game.points = [point1._id, point2._id]
        await game.save()

        const response = await request(app).get(`/api/v1/game/${game._id.toString()}/points`).send().expect(200)

        const { points } = response.body

        expect(points.length).toBe(2)
        expect(points[0].pointNumber).toBe(1)
        expect(points[0].teamOneScore).toBe(0)
        expect(points[0].teamTwoScore).toBe(1)

        expect(points[1].pointNumber).toBe(2)
        expect(points[1].teamOneScore).toBe(1)
        expect(points[1].teamTwoScore).toBe(1)
    })

    it('with no found points', async () => {
        const game = await Game.create(createData)
        const response = await request(app).get(`/api/v1/game/${game._id.toString()}/points`).send().expect(200)

        const { points } = response.body

        expect(points.length).toBe(0)
    })

    it('with service error', async () => {
        const response = await request(app).get(`/api/v1/game/${new Types.ObjectId()}/points`).send().expect(404)
        expect(response.body.message).toBe(Constants.UNABLE_TO_FIND_GAME)
    })
})

describe('test /GET search games', () => {
    const gameOneData = {
        creator: {
            _id: new Types.ObjectId(),
            firstName: 'First1',
            lastName: 'Last1',
            username: 'first1last1',
        },
        teamOne: {
            place: 'Pittsburgh',
            name: 'Temper',
            teamname: 'pghtemper',
        },
        teamTwo: {
            place: 'Seattle',
            name: 'Sockeye',
            teamname: 'seasock',
        },
        startTime: new Date('2020-01-01'),
        teamOneActive: true,
        tournament: {
            name: 'Mid-Atlantic Regionals 2020',
            eventId: 'mareg20',
        },
    }
    const gameTwoData = {
        creator: {
            _id: new Types.ObjectId(),
            firstName: 'First1',
            lastName: 'Last1',
            username: 'first1last1',
        },
        teamOne: {
            place: 'Pittsburgh',
            name: 'Temper',
            teamname: 'pghtemper',
        },
        teamTwo: {
            place: 'DC',
            name: 'Truck Stop',
            teamname: 'tsgh',
        },
        startTime: new Date('2021-06-01'),
        teamOneActive: true,
        tournament: {
            name: 'US Open 2021',
            eventId: 'usopen21',
        },
    }
    const gameThreeData = {
        creator: {
            _id: new Types.ObjectId(),
            firstName: 'First1',
            lastName: 'Last1',
            username: 'first1last1',
        },
        teamOne: {
            place: 'Virginia',
            name: 'Vault',
            teamname: 'vault',
        },
        teamTwo: {
            place: 'DC',
            name: 'Truck Stop',
            teamname: 'tsgh',
        },
        teamOneActive: false,
        startTime: new Date('2022-03-01'),
        tournament: {
            name: 'Philly Open',
            eventId: 'philly22',
        },
    }

    beforeEach(async () => {
        await Game.create(gameOneData)
        await Game.create(gameTwoData)
        await Game.create(gameThreeData)
    })

    it('with minimal parameters', async () => {
        const response = await request(app).get('/api/v1/game/search?q=pghtemper').send().expect(200)

        const { games } = response.body
        expect(games.length).toBe(2)
        expect(games[0].teamTwo.teamname).toBe('tsgh')
        expect(games[1].teamTwo.teamname).toBe('seasock')
    })

    it('with many params', async () => {
        const response = await request(app)
            .get('/api/v1/game/search?q=pghtemper&live&after=2021&before=2022&pageSize=1&offset=0')
            .send()
            .expect(200)

        const { games } = response.body
        expect(games.length).toBe(1)
        expect(games[0].teamOne.teamname).toBe('pghtemper')
    })

    it('with false live', async () => {
        const response = await request(app).get('/api/v1/game/search?live=false').send().expect(200)

        const { games } = response.body
        expect(games.length).toBe(1)
        expect(games[0].teamOne.teamname).toBe('vault')
    })

    it('with error', async () => {
        const response = await request(app).get('/api/v1/game/search?q=pghtemper&after=twentytwo').send().expect(500)
        expect(response.body.message).toBe(Constants.GENERIC_ERROR)
    })
})

describe('test /GET games by team id', () => {
    const teamOneId = new Types.ObjectId()
    const teamTwoId = new Types.ObjectId()
    const teamThreeId = new Types.ObjectId()

    const gameOneData = {
        creator: {
            _id: new Types.ObjectId(),
            firstName: 'First1',
            lastName: 'Last1',
            username: 'first1last1',
        },
        teamOne: {
            _id: teamOneId,
            place: 'Pittsburgh',
            name: 'Temper',
            teamname: 'pghtemper',
        },
        teamTwo: {
            _id: teamTwoId,
            place: 'Seattle',
            name: 'Sockeye',
            teamname: 'seasock',
        },
        startTime: new Date('2020-01-01'),
        teamOneActive: true,
        tournament: {
            name: 'Mid-Atlantic Regionals 2020',
            eventId: 'mareg20',
        },
    }
    const gameTwoData = {
        creator: {
            _id: new Types.ObjectId(),
            firstName: 'First1',
            lastName: 'Last1',
            username: 'first1last1',
        },
        teamOne: {
            _id: teamTwoId,
            place: 'Seattle',
            name: 'Sockeye',
            teamname: 'seasock',
        },
        teamTwo: {
            _id: teamThreeId,
            place: 'DC',
            name: 'Truck Stop',
            teamname: 'tsgh',
        },
        startTime: new Date('2022-03-01'),
        tournament: {
            name: 'Philly Open',
            eventId: 'philly22',
        },
    }

    beforeEach(async () => {
        await Game.create(gameOneData)
        await Game.create(gameTwoData)
    })

    it('with valid response', async () => {
        const response = await request(app).get(`/api/v1/game/team/${teamTwoId}`).send().expect(200)
        const { games } = response.body
        expect(games.length).toBe(2)
        expect(games[0].teamOne.teamname).toBe(gameOneData.teamOne.teamname)
        expect(games[0].teamTwo.teamname).toBe(gameOneData.teamTwo.teamname)
        expect(games[1].teamOne.teamname).toBe(gameTwoData.teamOne.teamname)
        expect(games[1].teamTwo.teamname).toBe(gameTwoData.teamTwo.teamname)
    })

    it('with error response', async () => {
        jest.spyOn(Game, 'find').mockImplementationOnce(() => {
            throw new ApiError(Constants.GENERIC_ERROR, 500)
        })
        const response = await request(app).get(`/api/v1/game/team/${teamTwoId}`).send().expect(500)
        expect(response.body.message).toBe(Constants.GENERIC_ERROR)
    })
})

describe('test /POST full game', () => {
    it('with valid data', async () => {
        const fullGame: CreateFullGame = {
            ...createData,
            teamOneScore: 1,
            teamTwoScore: 0,
            teamOnePlayers: [
                {
                    _id: new Types.ObjectId(),
                    firstName: 'First 1',
                    lastName: 'Last 1',
                    username: 'firstlast1',
                },
                { _id: new Types.ObjectId(), firstName: 'First 2', lastName: 'Last 2', username: 'firstlast2' },
                { _id: new Types.ObjectId(), firstName: 'First 3', lastName: 'Last 3', username: 'firstlast3' },
                { _id: new Types.ObjectId(), firstName: 'First 4', lastName: 'Last 4', username: 'firstlast4' },
                { _id: new Types.ObjectId(), firstName: 'First 5', lastName: 'Last 5', username: 'firstlast5' },
                { _id: new Types.ObjectId(), firstName: 'First 6', lastName: 'Last 6', username: 'firstlast6' },
                { _id: new Types.ObjectId(), firstName: 'First 7', lastName: 'Last 7', username: 'firstlast7' },
            ],
            points: [
                {
                    pointNumber: 1,
                    teamOneScore: 1,
                    teamTwoScore: 0,
                    pullingTeam: createData.teamTwo,
                    receivingTeam: createData.teamOne,
                    scoringTeam: createData.teamOne,
                    teamOnePlayers: [
                        {
                            _id: new Types.ObjectId(),
                            firstName: 'First 1',
                            lastName: 'Last 1',
                            username: 'firstlast1',
                        },
                        { _id: new Types.ObjectId(), firstName: 'First 2', lastName: 'Last 2', username: 'firstlast2' },
                        { _id: new Types.ObjectId(), firstName: 'First 3', lastName: 'Last 3', username: 'firstlast3' },
                        { _id: new Types.ObjectId(), firstName: 'First 4', lastName: 'Last 4', username: 'firstlast4' },
                        { _id: new Types.ObjectId(), firstName: 'First 5', lastName: 'Last 5', username: 'firstlast5' },
                        { _id: new Types.ObjectId(), firstName: 'First 6', lastName: 'Last 6', username: 'firstlast6' },
                        { _id: new Types.ObjectId(), firstName: 'First 7', lastName: 'Last 7', username: 'firstlast7' },
                    ],
                    actions: [
                        {
                            actionType: ActionType.CATCH,
                            playerOne: {
                                _id: new Types.ObjectId(),
                                firstName: 'First 1',
                                lastName: 'Last 1',
                                username: 'firstlast1',
                            },
                            tags: ['Huck'],
                        },
                        {
                            actionType: ActionType.TEAM_ONE_SCORE,
                            playerOne: {
                                _id: new Types.ObjectId(),
                                firstName: 'First 2',
                                lastName: 'Last 2',
                                username: 'firstlast2',
                            },
                            playerTwo: {
                                _id: new Types.ObjectId(),
                                firstName: 'First 3',
                                lastName: 'Last 3',
                                username: 'firstlast3',
                            },
                            tags: [],
                        },
                    ],
                },
            ],
        }

        const response = await request(app)
            .post('/api/v1/game/full')
            .set('Authorization', `Bearer jwt`)
            .send({ gameData: fullGame })
            .expect(201)

        const { game } = response.body
        expect(game.teamOnePlayers.length).toBe(7)
        expect(game.teamOneActive).toBe(false)
        expect(game.teamTwoActive).toBe(false)
        expect(game.creator.username).toBe('firstlast')
        expect(game.teamTwoPlayers.length).toBe(0)
        expect(game.teamOneScore).toBe(1)
        expect(game.teamTwoScore).toBe(0)
        expect(game.points.length).toBe(1)
    })

    it('with invalid data', async () => {
        const fullGame = { points: [], actions: [], teamOneScore: 0, teamTwoScore: 0 }

        const response = await request(app)
            .post('/api/v1/game/full')
            .set('Authorization', `Bearer jwt`)
            .send({ gameData: fullGame })
            .expect(500)

        expect(response.body.message).toBe(Constants.GENERIC_ERROR)
    })
})
