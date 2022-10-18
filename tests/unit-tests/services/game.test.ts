import * as Constants from '../../../src/utils/constants'
import { setUpDatabase, tearDownDatabase, createData, gameData, getMock, resetDatabase } from '../../fixtures/setup-db'
import GameServices from '../../../src/services/v1/game'
import Game from '../../../src/models/game'
import { ApiError } from '../../../src/types/errors'
import { CreateGame } from '../../../src/types/game'
import { Team, TeamNumber } from '../../../src/types/ultmt'
import { Types } from 'mongoose'
import jwt, { JwtPayload } from 'jsonwebtoken'
import axios from 'axios'
import randomstring from 'randomstring'
import Tournament from '../../../src/models/tournament'
import { CreateTournament } from '../../../src/types/tournament'
import Point from '../../../src/models/point'
import Action from '../../../src/models/action'

beforeAll(async () => {
    await setUpDatabase()
})

afterAll(async () => {
    await tearDownDatabase()
})

afterEach(async () => {
    await resetDatabase()
})

const userData = {
    _id: new Types.ObjectId(),
    firstName: 'Noah',
    lastName: 'Celuch',
    email: 'noah@email.com',
    username: 'noah',
    private: false,
    playerTeams: [],
    managerTeams: [],
    archiveTeams: [],
    stats: [],
    requests: [],
    openToRequests: false,
}

const services = new GameServices(Game, Point, Action, '', '')

beforeEach(() => {
    jest.spyOn(axios, 'get').mockImplementation(getMock)
})

afterEach(() => {
    jest.spyOn(axios, 'get').mockReset()
})

describe('test create game', () => {
    it('with valid data and team two not resolved', async () => {
        const { game, token } = await services.createGame(createData, 'jwt')

        const gameRecord = await Game.findById(game._id)
        expect(game._id.toString()).toBe(gameRecord?._id.toString())
        expect(game.teamOneScore).toBe(0)
        expect(game.teamTwoScore).toBe(0)
        expect(game.teamTwoActive).toBe(false)
        expect(game.teamTwoDefined).toBe(false)
        expect(gameRecord?.teamOneActive).toBe(true)
        expect(gameRecord?.teamTwoActive).toBe(false)
        expect(gameRecord?.creator.username).toBe('firstlast')
        expect(gameRecord?.teamOnePlayers.length).toBe(2)
        expect(gameRecord?.teamTwoPlayers.length).toBe(0)

        const payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload
        expect(payload.sub).toBe(game._id.toString())
        expect(payload.team).toBe('one')
        const expectedTime = Math.floor(new Date().getTime() / 1000) + 60 * 60 * 3
        expect(Math.abs((payload.exp || 0) - expectedTime)).toBeLessThan(5)
    })

    it('with valid data and team two resolved', async () => {
        const tournamentId = new Types.ObjectId()
        const { game, token } = await services.createGame(
            {
                ...createData,
                teamTwo: {
                    _id: new Types.ObjectId(),
                    name: 'Name 2',
                },
                teamTwoDefined: true,
                tournament: {
                    _id: tournamentId,
                    startDate: new Date('09-22-2022'),
                    endDate: new Date('09-23-2022'),
                    name: 'Mid-Atlantic Regionals 2022',
                    eventId: 'mareg22',
                },
            },
            'jwt',
        )

        const gameRecord = await Game.findById(game._id)
        expect(game._id.toString()).toBe(gameRecord?._id.toString())
        expect(game.teamOneScore).toBe(0)
        expect(game.teamTwoScore).toBe(0)
        expect(game.teamTwoActive).toBe(false)
        expect(game.teamTwoDefined).toBe(true)
        expect(game.tournament?._id.toString()).toBe(tournamentId.toString())
        expect(game.tournament?.eventId).toBe('mareg22')
        expect(token.length).toBeGreaterThan(20)
        expect(gameRecord?.teamOneActive).toBe(true)
        expect(gameRecord?.teamTwoActive).toBe(false)
        expect(gameRecord?.creator.username).toBe('firstlast')
        expect(gameRecord?.teamOnePlayers.length).toBe(2)
        expect(gameRecord?.teamTwoPlayers.length).toBe(2)
        expect(gameRecord?.tournament?._id.toString()).toBe(tournamentId.toString())
        expect(gameRecord?.tournament?.eventId).toBe('mareg22')
        const payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload
        expect(payload.sub).toBe(game._id.toString())
        expect(payload.team).toBe('one')
        expect(payload.exp).toBe(Math.floor(new Date().getTime() / 1000) + 60 * 60 * 3)
    })

    it('with fetch error', async () => {
        getMock.mockImplementationOnce(() => Promise.resolve({ status: 401 }))
        await expect(services.createGame(createData, 'jwt')).rejects.toThrowError(
            new ApiError(Constants.UNAUTHENTICATED_USER, 401),
        )

        const games = await Game.find({})
        expect(games.length).toBe(0)
    })

    it('with unfound team one', async () => {
        getMock.mockImplementationOnce(() => {
            return Promise.resolve({ data: { user: userData }, status: 200 })
        })
        getMock.mockImplementationOnce(() => {
            return Promise.resolve({ ok: false })
        })

        await expect(
            services.createGame({ ...createData, teamOne: { _id: new Types.ObjectId(), name: 'Name 1' } }, 'jwt'),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 404))
        const games = await Game.find({})
        expect(games.length).toBe(0)
    })

    it('with unfound team two', async () => {
        getMock.mockImplementationOnce(() => {
            return Promise.resolve({ data: { user: userData }, status: 200 })
        })
        getMock.mockImplementationOnce(() => {
            return Promise.resolve({
                json: () =>
                    Promise.resolve({
                        team: {
                            _id: new Types.ObjectId(),
                            players: [
                                {
                                    _id: new Types.ObjectId(),
                                    firstName: 'player 1',
                                    lastName: 'last 1',
                                    username: 'player1',
                                },
                                {
                                    _id: new Types.ObjectId(),
                                    firstName: 'player 2',
                                    lastName: 'last 2',
                                    username: 'player2',
                                },
                            ],
                        },
                    }),
                ok: true,
                status: 200,
            })
        })

        await expect(services.createGame({ ...createData, teamTwoDefined: true }, 'jwt')).rejects.toThrowError(
            new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 404),
        )
        const games = await Game.find({})
        expect(games.length).toBe(0)
    })

    it('with unsafe data', async () => {
        const { game, token } = await services.createGame(
            {
                ...createData,
                teamOnePlayers: ['player 1', 'player 2', 'player 5', 'player 6'],
                teamTwoPlayers: ['player 3', 'player 4'],
                token: 'token1',
                teamOneScore: 21,
                teamTwoScore: -99,
                teamTwoActive: true,
            } as CreateGame,
            'jwt',
        )

        const gameRecord = await Game.findById(game._id)
        expect(game._id.toString()).toBe(gameRecord?._id.toString())
        expect(game.teamOneScore).toBe(0)
        expect(game.teamTwoScore).toBe(0)
        expect(game.teamTwoActive).toBe(false)
        expect(token.length).toBeGreaterThan(20)
        expect(gameRecord?.teamOneActive).toBe(true)
        expect(gameRecord?.creator.username).toBe('firstlast')
        expect(gameRecord?.teamOnePlayers.length).toBe(2)
        expect(gameRecord?.teamTwoPlayers.length).toBe(0)
        expect(gameRecord?.teamOneScore).toBe(0)
        expect(gameRecord?.teamTwoScore).toBe(0)
        expect(gameRecord?.resolveCode.length).toBe(6)
    })

    it('with jwt error', async () => {
        jest.spyOn(jwt, 'sign').mockImplementationOnce(() => {
            throw new Error('bad message')
        })
        expect(services.createGame(createData, 'jwt')).rejects.toThrowError('bad message')
    })
})

describe('test edit game', () => {
    it('should update with valid data and no team 2', async () => {
        const game = await Game.create(gameData)

        const updatedGame = await services.updateGame(game._id.toString(), {
            timeoutPerHalf: 10,
            floaterTimeout: false,
        })

        expect(updatedGame.floaterTimeout).toBe(false)
        expect(updatedGame.teamOneActive).toBe(true)
        expect(updatedGame.teamTwoActive).toBe(false)

        const gameRecord = await Game.findById(game._id)
        expect(gameRecord?.floaterTimeout).toBe(false)
        expect(gameRecord?.timeoutPerHalf).toBe(10)
        expect(gameRecord?.teamTwoDefined).toBe(false)
        expect(gameRecord?.teamOneActive).toBe(true)
        expect(gameRecord?.teamTwoActive).toBe(false)
    })

    it('should update with valid data and team 2', async () => {
        const game = await Game.create(gameData)

        const updatedGame = await services.updateGame(game._id.toString(), {
            ...createData,
            timeoutPerHalf: 0,
            teamTwo: { _id: new Types.ObjectId(), place: 'Place 2', name: 'Name 2', teamname: 'place2name2' },
            teamTwoDefined: true,
        })

        expect(updatedGame.teamTwoActive).toBe(false)
        expect(updatedGame.teamTwoDefined).toBe(true)
        expect(updatedGame.teamTwo?.place).toBe('Place 2')
        expect(updatedGame.teamTwoPlayers.length).toBe(2)
        expect(updatedGame.teamOneActive).toBe(true)
        expect(updatedGame.teamTwoActive).toBe(false)

        const gameRecord = await Game.findById(updatedGame._id)
        expect(gameRecord?.teamTwoActive).toBe(false)
        expect(gameRecord?.teamTwoDefined).toBe(true)
        expect(gameRecord?.teamTwoPlayers.length).toBe(2)
        expect(gameRecord?.teamOneActive).toBe(true)
        expect(gameRecord?.teamTwoActive).toBe(false)
    })

    it('with tournament', async () => {
        const tournamentData: CreateTournament = {
            startDate: new Date('09-22-2022'),
            endDate: new Date('09-23-2022'),
            name: 'Mid-Atlantic Regionals 2022',
            eventId: 'mareg22',
        }
        const tournament = await Tournament.create(tournamentData)
        const game = await Game.create(gameData)

        const updatedGame = await services.updateGame(game._id.toString(), {
            tournament,
        })
        expect(updatedGame.teamOneActive).toBe(true)
        expect(updatedGame.tournament?._id.toString()).toBe(tournament._id.toString())
        expect(updatedGame.tournament?.eventId).toBe(tournament.eventId)

        const gameRecord = await Game.findById(game._id)
        expect(gameRecord?.tournament?.eventId).toBe(tournament.eventId)
    })

    it('with unfound game', async () => {
        await Game.create(gameData)

        await expect(
            services.updateGame(new Types.ObjectId().toString(), {
                ...createData,
                teamTwo: { _id: new Types.ObjectId(), place: 'Place 2', name: 'Name 2', teamname: 'place2name2' },
                teamTwoDefined: true,
            }),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FIND_GAME, 404))
    })

    it('with bad team response', async () => {
        const game = await Game.create(gameData)
        getMock.mockImplementationOnce(() => {
            return Promise.resolve({ ok: false, status: 404 })
        })
        await expect(
            services.updateGame(game._id.toString(), {
                ...createData,
                teamTwo: { _id: new Types.ObjectId(), place: 'Place 2', name: 'Name 2', teamname: 'place2name2' },
                teamTwoDefined: true,
            }),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 404))
    })
})

describe('test team two join', () => {
    it('with valid data', async () => {
        const initialGame = await Game.create(gameData)
        initialGame.teamTwo = {
            _id: new Types.ObjectId(),
            place: 'Place 2',
            name: 'Name 2',
            teamname: 'place2name2',
        }
        await initialGame.save()

        const { game, token } = await services.teamTwoJoinGame(
            initialGame._id.toString(),
            initialGame.teamTwo._id?.toString() || '',
            'asdf1234.asdf145radsf.ad43grad',
            initialGame.resolveCode,
        )

        const gameRecord = await Game.findById(initialGame._id)
        expect(game._id).toEqual(initialGame._id)
        expect(gameRecord?.teamTwoActive).toBe(true)
        const payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload
        expect(payload.sub).toBe(game._id.toString())
        expect(payload.team).toBe('two')
        const expectedTime = Math.floor(new Date().getTime() / 1000) + 60 * 60 * 3
        expect(Math.abs((payload.exp || 0) - expectedTime)).toBeLessThan(5)
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

        await expect(
            services.teamTwoJoinGame(
                new Types.ObjectId().toString(),
                initialGame.teamTwo._id?.toString() || '',
                'asdf1234.asdf145radsf.ad43grad',
                initialGame.resolveCode,
            ),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FIND_GAME, 404))

        const gameRecord = await Game.findById(initialGame._id)
        expect(gameRecord?.teamTwoActive).toBe(false)
    })

    it('with unfound user', async () => {
        getMock.mockImplementationOnce(() => {
            return Promise.resolve({
                status: 401,
            })
        })
        const initialGame = await Game.create(gameData)
        initialGame.teamTwo = {
            _id: new Types.ObjectId(),
            place: 'Place 2',
            name: 'Name 2',
            teamname: 'place2name2',
        }
        await initialGame.save()

        await expect(
            services.teamTwoJoinGame(
                initialGame._id.toString(),
                initialGame.teamTwo._id?.toString() || '',
                'asdf1234.asdf145radsf.ad43grad',
                initialGame.resolveCode,
            ),
        ).rejects.toThrowError(new ApiError(Constants.UNAUTHENTICATED_USER, 401))

        const gameRecord = await Game.findById(initialGame._id)
        expect(gameRecord?.teamTwoActive).toBe(false)
    })

    it('with user from wrong team', async () => {
        getMock.mockImplementationOnce(() => {
            return Promise.resolve({ data: { user: userData }, status: 200 })
        })
        const initialGame = await Game.create(gameData)
        initialGame.teamTwo = {
            _id: new Types.ObjectId(),
            place: 'Place 2',
            name: 'Name 2',
            teamname: 'place2name2',
        }
        await initialGame.save()

        await expect(
            services.teamTwoJoinGame(
                initialGame._id.toString(),
                new Types.ObjectId().toString(),
                'asdf1234.asdf145radsf.ad43grad',
                initialGame.resolveCode,
            ),
        ).rejects.toThrowError(new ApiError(Constants.UNAUTHENTICATED_USER, 401))

        const gameRecord = await Game.findById(initialGame._id)
        expect(gameRecord?.teamTwoActive).toBe(false)
    })

    it('with wrong resolve code', async () => {
        jest.spyOn(randomstring, 'generate').mockImplementationOnce(() => {
            return '123456'
        })

        const initialGame = await Game.create(gameData)
        initialGame.teamTwo = {
            _id: new Types.ObjectId(),
            place: 'Place 2',
            name: 'Name 2',
            teamname: 'place2name2',
        }
        await initialGame.save()

        await expect(
            services.teamTwoJoinGame(
                initialGame._id.toString(),
                initialGame.teamTwo._id?.toString() || '',
                'asdf1234.asdf145radsf.ad43grad',
                '654321',
            ),
        ).rejects.toThrowError(new ApiError(Constants.WRONG_RESOLVE_CODE, 401))

        const gameRecord = await Game.findById(initialGame._id)
        expect(gameRecord?.teamTwoActive).toBe(false)
    })
})

describe('test add guest player to team', () => {
    it('with valid data for team one', async () => {
        const game = await Game.create(gameData)

        const gameResult = await services.addGuestPlayer(game._id.toString(), TeamNumber.ONE, {
            firstName: 'Noah',
            lastName: 'Celuch',
        })

        expect(gameResult.teamOnePlayers.length).toBe(1)
        expect(gameResult.teamOnePlayers[0]._id).toBeUndefined()
        expect(gameResult.teamOnePlayers[0].firstName).toBe('Noah')
        expect(gameResult.teamOnePlayers[0].lastName).toBe('Celuch')
        expect(gameResult.teamOnePlayers[0].username).toBe('guest')

        const gameRecord = await Game.findById(game._id)
        expect(gameRecord?.teamOnePlayers.length).toBe(1)
        expect(gameRecord?.teamOnePlayers[0]._id).toBeUndefined()
        expect(gameRecord?.teamOnePlayers[0].firstName).toBe('Noah')
        expect(gameRecord?.teamOnePlayers[0].lastName).toBe('Celuch')
        expect(gameRecord?.teamOnePlayers[0].username).toBe('guest')
    })

    it('with valid data for team two', async () => {
        const game = await Game.create(gameData)
        game.teamTwoActive = true
        game.teamTwoDefined = true
        await game.save()

        const gameResult = await services.addGuestPlayer(game._id.toString(), TeamNumber.TWO, {
            firstName: 'Noah',
            lastName: 'Celuch',
        })

        expect(gameResult.teamTwoPlayers.length).toBe(1)
        expect(gameResult.teamTwoPlayers[0]._id).toBeUndefined()
        expect(gameResult.teamTwoPlayers[0].firstName).toBe('Noah')
        expect(gameResult.teamTwoPlayers[0].lastName).toBe('Celuch')
        expect(gameResult.teamTwoPlayers[0].username).toBe('guest')

        const gameRecord = await Game.findById(game._id)
        expect(gameRecord?.teamTwoPlayers.length).toBe(1)
        expect(gameRecord?.teamTwoPlayers[0]._id).toBeUndefined()
        expect(gameRecord?.teamTwoPlayers[0].firstName).toBe('Noah')
        expect(gameRecord?.teamTwoPlayers[0].lastName).toBe('Celuch')
        expect(gameRecord?.teamTwoPlayers[0].username).toBe('guest')
    })

    it('with unfound game', async () => {
        await Game.create(gameData)

        await expect(
            services.addGuestPlayer(new Types.ObjectId().toString(), TeamNumber.ONE, {
                firstName: 'Noah',
                lastName: 'Celuch',
            }),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FIND_GAME, 404))
    })

    it('with unable to add player', async () => {
        const game = await Game.create(gameData)

        await expect(
            services.addGuestPlayer(game._id.toString(), TeamNumber.TWO, {
                firstName: 'Noah',
                lastName: 'Celuch',
            }),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_ADD_PLAYER, 400))
    })
})

describe('test finish game', () => {
    it('with only team one', async () => {
        const gameData = await Game.create(createData)

        const game = await services.finishGame(gameData._id.toString(), TeamNumber.ONE)

        expect(game.teamOneActive).toBe(false)
        expect(game.teamTwoActive).toBe(false)
        expect(game.scoreLimit).toBe(gameData.scoreLimit)

        const gameRecord = await Game.findById(gameData._id)
        expect(gameRecord?.teamOneActive).toBe(false)
        expect(gameRecord?.teamTwoActive).toBe(false)
    })

    it('with only team two', async () => {
        const gameData = await Game.create({ ...createData, teamTwoActive: true })

        const game = await services.finishGame(gameData._id.toString(), TeamNumber.TWO)

        expect(game.teamOneActive).toBe(true)
        expect(game.teamTwoActive).toBe(false)
        expect(game.scoreLimit).toBe(gameData.scoreLimit)

        const gameRecord = await Game.findById(gameData._id)
        expect(gameRecord?.teamOneActive).toBe(true)
        expect(gameRecord?.teamTwoActive).toBe(false)
    })

    it('with both teams', async () => {
        const gameData = await Game.create({ ...createData, teamTwoActive: true })

        await services.finishGame(gameData._id.toString(), TeamNumber.ONE)
        const game = await services.finishGame(gameData._id.toString(), TeamNumber.TWO)

        expect(game.teamOneActive).toBe(false)
        expect(game.teamTwoActive).toBe(false)
        expect(game.scoreLimit).toBe(gameData.scoreLimit)

        const gameRecord = await Game.findById(gameData._id)
        expect(gameRecord?.teamOneActive).toBe(false)
        expect(gameRecord?.teamTwoActive).toBe(false)
    })

    it('with unfound game', async () => {
        await expect(services.finishGame(new Types.ObjectId().toString(), TeamNumber.ONE)).rejects.toThrowError(
            new ApiError(Constants.UNABLE_TO_FIND_GAME, 404),
        )
    })
})

describe('test reactivate game', () => {
    it('with valid data for team one', async () => {
        const initGame = await Game.create(createData)
        initGame.teamOneActive = false
        await initGame.save()

        const { game, token } = await services.reactivateGame(
            initGame._id.toString(),
            'jwt',
            initGame.teamOne._id?.toString() || '',
        )

        const payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload
        expect(payload.sub).toBe(initGame._id.toString())
        expect(payload.team).toBe('one')
        const expectedTime = Math.floor(new Date().getTime() / 1000) + 60 * 60 * 3
        expect(Math.abs((payload.exp || 0) - expectedTime)).toBeLessThan(5)

        expect(game.teamOneActive).toBe(true)

        const gameRecord = await Game.findById(game._id)
        expect(gameRecord?.teamOneActive).toBe(true)
    })

    it('with valid data for team two', async () => {
        const initGame = await Game.create(createData)
        initGame.teamTwoActive = false
        initGame.teamTwo._id = new Types.ObjectId()
        await initGame.save()

        const { game, token } = await services.reactivateGame(
            initGame._id.toString(),
            'jwt',
            initGame.teamTwo._id?.toString() || '',
        )

        const payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload
        expect(payload.sub).toBe(initGame._id.toString())
        expect(payload.team).toBe('two')
        const expectedTime = Math.floor(new Date().getTime() / 1000) + 60 * 60 * 3
        expect(Math.abs((payload.exp || 0) - expectedTime)).toBeLessThan(5)

        expect(game.teamTwoActive).toBe(true)

        const gameRecord = await Game.findById(game._id)
        expect(gameRecord?.teamTwoActive).toBe(true)
    })

    it('with unfound game', async () => {
        await expect(services.reactivateGame(new Types.ObjectId().toString(), 'jwt', 'teamid')).rejects.toThrowError(
            new ApiError(Constants.UNABLE_TO_FIND_GAME, 404),
        )
    })

    it('with team not on game', async () => {
        const initGame = await Game.create(createData)
        initGame.teamOneActive = false
        await initGame.save()

        await expect(services.reactivateGame(initGame._id.toString(), 'jwt', 'teamid')).rejects.toThrowError(
            new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 400),
        )
    })

    it('with invalid user', async () => {
        const initGame = await Game.create(createData)
        getMock.mockImplementationOnce(() => Promise.resolve({ status: 401 }))
        await expect(
            services.reactivateGame(initGame._id.toString(), 'jwt', initGame.teamOne._id?.toString() || ''),
        ).rejects.toThrowError(new ApiError(Constants.UNAUTHENTICATED_USER, 401))
    })
})

describe('test delete game', () => {
    const team: Team = {
        _id: new Types.ObjectId(),
        seasonStart: new Date(),
        seasonEnd: new Date(),
        place: 'Place 1',
        name: 'Name 1',
        teamname: 'placename',
    }
    const team2: Team = {
        _id: new Types.ObjectId(),
        seasonStart: new Date(),
        seasonEnd: new Date(),
        place: 'Place 2',
        name: 'Name 2',
        teamname: 'placename2',
    }
    beforeAll(() => {
        getMock.mockImplementationOnce(() => {
            return Promise.resolve({ data: { user: userData }, status: 200 })
        })
    })

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
    })
    it('with team one and team two not defined', async () => {
        const [point1, point2] = await Point.find({})
        const game = await Game.create({
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
        await services.deleteGame(game._id.toString(), 'jwt', team._id?.toString() || '')
        const actions = await Action.find({})
        expect(actions.length).toBe(0)

        const points = await Point.find({})
        expect(points.length).toBe(0)

        const games = await Game.find({})
        expect(games.length).toBe(0)
    })

    it('with team one and team two defined', async () => {
        const action4 = await Action.create({
            team: team2,
            actionNumber: 1,
            actionType: 'Drop',
        })
        const action5 = await Action.create({
            team: team2,
            actionNumber: 1,
            actionType: 'TeamOneScore',
        })
        const [point1, point2] = await Point.find({})
        point1.pullingTeam = team2
        await point1.save()
        point2.teamTwoActions = [action4._id, action5._id]
        point2.receivingTeam = team2
        await point2.save()
        const game = await Game.create({
            teamOne: team,
            teamTwo: team2,
            teamTwoDefined: true,
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

        await services.deleteGame(game._id.toString(), 'jwt', team._id?.toString() || '')
        const actions = await Action.find({})
        expect(actions.length).toBe(2)
        expect(actions[0].team.teamname).toBe(action4.team.teamname)
        expect(actions[0].actionType).toBe(action4.actionType)
        expect(actions[1].team.teamname).toBe(action5.team.teamname)
        expect(actions[1].actionType).toBe(action5.actionType)

        const points = await Point.find({})
        expect(points.length).toBe(2)
        expect(points[0].teamOneActions.length).toBe(0)
        expect(points[0].receivingTeam._id).toBeUndefined()
        expect(points[0].receivingTeam.teamname).toBeUndefined()
        expect(points[0].receivingTeam.name).toBe(team.name)
        expect(points[0].scoringTeam?._id).toBeUndefined()
        expect(points[0].scoringTeam?.teamname).toBeUndefined()
        expect(points[0].scoringTeam?.name).toBe(team.name)
        expect(points[0].pullingTeam.teamname).toBe(team2.teamname)

        expect(points[1].teamOneActions.length).toBe(0)
        expect(points[1].teamTwoActions.length).toBe(2)
        expect(points[1].pullingTeam._id).toBeUndefined()
        expect(points[1].pullingTeam.teamname).toBeUndefined()
        expect(points[1].pullingTeam.name).toBe(team.name)
        expect(points[1].scoringTeam?._id).toBeUndefined()
        expect(points[1].scoringTeam?.teamname).toBeUndefined()
        expect(points[1].scoringTeam?.name).toBe(team.name)
        expect(points[1].receivingTeam.teamname).toBe(team2.teamname)

        const games = await Game.find({})
        expect(games.length).toBe(1)
        expect(games[0].teamOne._id).toBeUndefined()
        expect(games[0].teamOne.teamname).toBeUndefined()
        expect(games[0].teamOne.name).toBe(team.name)
        expect(games[0].teamTwo._id?.toString()).toBe(team2._id?.toString())
        expect(games[0].teamTwo.teamname).toBe(team2.teamname)
    })

    it('with team two', async () => {
        const [action1, action2, action3] = await Action.find({})
        const action4 = await Action.create({
            team: team2,
            actionNumber: 1,
            actionType: 'Drop',
        })
        const action5 = await Action.create({
            team: team2,
            actionNumber: 1,
            actionType: 'TeamOneScore',
        })
        const [point1, point2] = await Point.find({})
        point1.pullingTeam = team2
        await point1.save()
        point2.teamTwoActions = [action4._id, action5._id]
        point2.receivingTeam = team2
        await point2.save()
        const game = await Game.create({
            teamOne: team,
            teamTwo: team2,
            teamTwoDefined: true,
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

        await services.deleteGame(game._id.toString(), 'jwt', team2._id?.toString() || '')
        const actions = await Action.find({})
        expect(actions.length).toBe(3)
        expect(actions[0].team.teamname).toBe(action1.team.teamname)
        expect(actions[0].actionType).toBe(action1.actionType)
        expect(actions[1].team.teamname).toBe(action2.team.teamname)
        expect(actions[1].actionType).toBe(action2.actionType)
        expect(actions[2].team.teamname).toBe(action3.team.teamname)
        expect(actions[2].actionType).toBe(action3.actionType)

        const points = await Point.find({})
        expect(points.length).toBe(2)
        expect(points[0].teamOneActions.length).toBe(1)
        expect(points[0].pullingTeam._id).toBeUndefined()
        expect(points[0].pullingTeam.teamname).toBeUndefined()
        expect(points[0].pullingTeam.name).toBe(team2.name)
        expect(points[0].scoringTeam?._id?.toString()).toBe(team._id?.toString())
        expect(points[0].scoringTeam?.teamname).toBe(team.teamname)
        expect(points[0].scoringTeam?.name).toBe(team.name)
        expect(points[0].receivingTeam.teamname).toBe(team.teamname)

        expect(points[1].teamOneActions.length).toBe(2)
        expect(points[1].teamTwoActions.length).toBe(0)
        expect(points[1].receivingTeam._id).toBeUndefined()
        expect(points[1].receivingTeam.teamname).toBeUndefined()
        expect(points[1].receivingTeam.name).toBe(team2.name)
        expect(points[1].scoringTeam?._id?.toString()).toBe(team._id?.toString())
        expect(points[1].scoringTeam?.teamname).toBe(team.teamname)
        expect(points[1].scoringTeam?.name).toBe(team.name)
        expect(points[1].pullingTeam.teamname).toBe(team.teamname)

        const games = await Game.find({})
        expect(games.length).toBe(1)
        expect(games[0].teamTwo._id).toBeUndefined()
        expect(games[0].teamTwo.teamname).toBeUndefined()
        expect(games[0].teamTwo.name).toBe(team2.name)
        expect(games[0].teamOne._id?.toString()).toBe(team._id?.toString())
        expect(games[0].teamOne.teamname).toBe(team.teamname)
    })
})
