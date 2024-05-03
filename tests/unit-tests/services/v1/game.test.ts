import * as Constants from '../../../../src/utils/constants'
import * as CloudTaskServices from '../../../../src/utils/cloud-tasks'
import * as UltmtUtils from '../../../../src/utils/ultmt'
import {
    setUpDatabase,
    tearDownDatabase,
    createData,
    gameData,
    getMock,
    resetDatabase,
} from '../../../fixtures/setup-db'
import GameServices from '../../../../src/services/v1/game'
import Game from '../../../../src/models/game'
import { ApiError } from '../../../../src/types/errors'
import { CreateFullGame, CreateGame, GameStatus } from '../../../../src/types/game'
import { Team, TeamNumber, TeamResponse } from '../../../../src/types/ultmt'
import { Types } from 'mongoose'
import jwt, { JwtPayload } from 'jsonwebtoken'
import axios from 'axios'
import randomstring from 'randomstring'
import Tournament from '../../../../src/models/tournament'
import { CreateTournament } from '../../../../src/types/tournament'
import Point from '../../../../src/models/point'
import Action from '../../../../src/models/action'
import { ActionType } from '../../../../src/types/action'

jest.mock('@google-cloud/tasks/build/src/v2')

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

const services = new GameServices(Game, Point, Action, Tournament, '', '')

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
                    creator: createData.creator,
                },
            },
            'jwt',
        )

        const tournament = await Tournament.findOne()

        const gameRecord = await Game.findById(game._id)
        expect(game._id.toString()).toBe(gameRecord?._id.toString())
        expect(game.teamOneScore).toBe(0)
        expect(game.teamTwoScore).toBe(0)
        expect(game.teamTwoActive).toBe(false)
        expect(game.teamTwoDefined).toBe(true)
        expect(game.tournament?._id.toString()).toBe(tournament?._id.toHexString())
        expect(game.tournament?.eventId).toBe('mareg22')
        expect(token.length).toBeGreaterThan(20)
        expect(gameRecord?.teamOneActive).toBe(true)
        expect(gameRecord?.teamTwoActive).toBe(false)
        expect(gameRecord?.creator.username).toBe('firstlast')
        expect(gameRecord?.teamOnePlayers.length).toBe(2)
        expect(gameRecord?.teamTwoPlayers.length).toBe(2)
        expect(gameRecord?.tournament?._id.toHexString()).toBe(tournament?._id.toHexString())
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
        expect(gameRecord?.teamTwoJoined).toBe(true)
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
            _id: new Types.ObjectId(),
            firstName: 'Noah',
            lastName: 'Celuch',
            username: 'noah',
        })

        expect(gameResult.teamOnePlayers.length).toBe(1)
        expect(gameResult.teamOnePlayers[0]._id).toBeDefined()
        expect(gameResult.teamOnePlayers[0].firstName).toBe('Noah')
        expect(gameResult.teamOnePlayers[0].lastName).toBe('Celuch')
        expect(gameResult.teamOnePlayers[0].username).toBe('guest')

        const gameRecord = await Game.findById(game._id)
        expect(gameRecord?.teamOnePlayers.length).toBe(1)
        expect(gameRecord?.teamOnePlayers[0]._id).toBeDefined()
        expect(gameRecord?.teamOnePlayers[0].firstName).toBe('Noah')
        expect(gameRecord?.teamOnePlayers[0].lastName).toBe('Celuch')
        expect(gameRecord?.teamOnePlayers[0].username).toBe('guest')
    })

    it('with valid data for team two', async () => {
        const game = await Game.create(gameData)
        game.teamTwoActive = true
        game.teamTwoDefined = true
        game.teamTwoStatus = GameStatus.ACTIVE
        await game.save()

        const gameResult = await services.addGuestPlayer(game._id.toString(), TeamNumber.TWO, {
            _id: new Types.ObjectId(),
            firstName: 'Noah',
            lastName: 'Celuch',
            username: 'noah',
        })

        expect(gameResult.teamTwoPlayers.length).toBe(1)
        expect(gameResult.teamTwoPlayers[0]._id).toBeDefined()
        expect(gameResult.teamTwoPlayers[0].firstName).toBe('Noah')
        expect(gameResult.teamTwoPlayers[0].lastName).toBe('Celuch')
        expect(gameResult.teamTwoPlayers[0].username).toBe('guest')

        const gameRecord = await Game.findById(game._id)
        expect(gameRecord?.teamTwoPlayers.length).toBe(1)
        expect(gameRecord?.teamTwoPlayers[0]._id).toBeDefined()
        expect(gameRecord?.teamTwoPlayers[0].firstName).toBe('Noah')
        expect(gameRecord?.teamTwoPlayers[0].lastName).toBe('Celuch')
        expect(gameRecord?.teamTwoPlayers[0].username).toBe('guest')
    })

    it('with unfound game', async () => {
        await Game.create(gameData)

        await expect(
            services.addGuestPlayer(new Types.ObjectId().toString(), TeamNumber.ONE, {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            }),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FIND_GAME, 404))
    })

    it('with unable to add player', async () => {
        const game = await Game.create(gameData)

        await expect(
            services.addGuestPlayer(game._id.toString(), TeamNumber.TWO, {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
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
    const gameId = new Types.ObjectId()
    const pointOneId = new Types.ObjectId()
    const pointTwoId = new Types.ObjectId()

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
            pointId: pointOneId,
        })
        const action2 = await Action.create({
            team,
            actionNumber: 1,
            actionType: 'Pull',
            pointId: pointTwoId,
        })
        const action3 = await Action.create({
            team,
            actionNumber: 2,
            actionType: 'TeamOneScore',
            pointId: pointTwoId,
        })

        await Point.create({
            gameId,
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
            gameId,
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

    it('with team one and team two not joined', async () => {
        const [point1, point2] = await Point.find({})
        const game = await Game.create({
            _id: gameId,
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
            teamTwoJoined: false,
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

    it('with team one and team two joined', async () => {
        const action4 = await Action.create({
            team: team2,
            actionNumber: 1,
            actionType: 'Drop',
            pointId: pointTwoId,
        })
        const action5 = await Action.create({
            team: team2,
            actionNumber: 1,
            actionType: 'TeamOneScore',
            pointId: pointTwoId,
        })

        const [point1, point2] = await Point.find({})
        point1.pullingTeam = team2
        await point1.save()

        point2.teamTwoActions = [action4._id, action5._id]
        point2.receivingTeam = team2
        await point2.save()

        const game = await Game.create({
            _id: gameId,
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
            teamTwoJoined: true,
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

    it('with team two and team one not deleted', async () => {
        const [action1, action2, action3] = await Action.find({})
        const action4 = await Action.create({
            team: team2,
            actionNumber: 1,
            actionType: 'Drop',
            pointId: pointTwoId,
        })
        const action5 = await Action.create({
            team: team2,
            actionNumber: 1,
            actionType: 'TeamOneScore',
            pointId: pointTwoId,
        })
        const [point1, point2] = await Point.find({})
        point1.pullingTeam = team2
        await point1.save()
        point2.teamTwoActions = [action4._id, action5._id]
        point2.receivingTeam = team2
        await point2.save()
        const game = await Game.create({
            _id: gameId,
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

    it('with team two and team one deleted', async () => {
        await Action.deleteMany({})
        const action4 = await Action.create({
            team: team2,
            actionNumber: 1,
            actionType: 'Drop',
            pointId: pointTwoId,
        })
        const action5 = await Action.create({
            team: team2,
            actionNumber: 1,
            actionType: 'TeamOneScore',
            pointId: pointTwoId,
        })
        const [point1, point2] = await Point.find({})
        point1.pullingTeam = team2
        await point1.save()
        point2.teamTwoActions = [action4._id, action5._id]
        point2.receivingTeam = team2
        await point2.save()
        const game = await Game.create({
            _id: gameId,
            teamOne: { ...team, _id: undefined },
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
        expect(actions.length).toBe(0)

        const points = await Point.find({})
        expect(points.length).toBe(0)

        const games = await Game.find({})
        expect(games.length).toBe(0)
    })
})

describe('test get game', () => {
    it('with found game', async () => {
        const initGame = await Game.create(gameData)

        const game = await services.getGame(initGame._id.toString())
        expect(game._id.toString()).toBe(initGame._id.toString())
        expect(game.creator.username).toBe(initGame.creator.username)
        expect(game.floaterTimeout).toBe(initGame.floaterTimeout)
        expect(game.halfScore).toBe(initGame.halfScore)
        expect(game.startTime.toString()).toBe(initGame.startTime.toString())
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
        await expect(services.getGame(new Types.ObjectId().toString())).rejects.toThrowError(
            new ApiError(Constants.UNABLE_TO_FIND_GAME, 404),
        )
    })
})

describe('test get points', () => {
    const gameId = new Types.ObjectId()
    beforeEach(async () => {
        await Point.create({
            gameId,
            pointNumber: 1,
            pullingTeam: { name: 'Team 1' },
            receivingTeam: { name: 'Team 2' },
            teamOneScore: 0,
            teamTwoScore: 1,
        })
        await Point.create({
            gameId,
            pointNumber: 2,
            pullingTeam: { name: 'Team 2' },
            receivingTeam: { name: 'Team 1' },
            teamOneScore: 1,
            teamTwoScore: 1,
        })
        await Point.create({
            gameId,
            pointNumber: 3,
            pullingTeam: { name: 'Team 1' },
            receivingTeam: { name: 'Team 2' },
            teamOneScore: 1,
            teamTwoScore: 2,
        })
    })

    it('with multiple found points', async () => {
        const [point1, point2] = await Point.find({})
        const game = await Game.create({ ...createData, _id: gameId })
        game.points = [point1._id, point2._id]
        await game.save()

        const points = await services.getPointsByGame(game._id.toString())
        expect(points.length).toBe(2)
        expect(points[0].pointNumber).toBe(1)
        expect(points[0].teamOneScore).toBe(0)
        expect(points[0].teamTwoScore).toBe(1)

        expect(points[1].pointNumber).toBe(2)
        expect(points[1].teamOneScore).toBe(1)
        expect(points[1].teamTwoScore).toBe(1)
    })

    it('with no found points', async () => {
        const game = await Game.create({ ...createData, _id: gameId })
        const points = await services.getPointsByGame(game._id.toString())
        expect(points.length).toBe(0)
    })

    it('with unfound values in array', async () => {
        const game = await Game.create({ ...createData, _id: gameId })
        game.points = [new Types.ObjectId(), new Types.ObjectId()]
        await game.save()
        const points = await services.getPointsByGame(game._id.toString())
        expect(points.length).toBe(0)
    })
})

describe('test search', () => {
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
        teamOneStatus: GameStatus.ACTIVE,
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
        teamOneActive: false,
        teamOneStatus: GameStatus.COMPLETE,
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
        teamTwoStatus: GameStatus.ACTIVE,
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

    it('with simple search by team name', async () => {
        const games = await services.searchGames('temper')
        expect(games.length).toBe(2)
        expect(games[0].teamTwo.teamname).toBe('tsgh')
        expect(games[1].teamTwo.teamname).toBe('seasock')
    })

    it('with simple search by tournament name', async () => {
        const games = await services.searchGames('usopen21')
        expect(games.length).toBe(1)
        expect(games[0].teamOne.teamname).toBe('pghtemper')
        expect(games[0].teamTwo.teamname).toBe('tsgh')
    })

    it('with live filter', async () => {
        const games = await services.searchGames(undefined, true)
        expect(games.length).toBe(2)
        expect(games[0].teamOne.teamname).toBe('vault')
        expect(games[1].teamOne.teamname).toBe('pghtemper')
    })

    it('with search and live filter', async () => {
        const games = await services.searchGames('vau', true)
        expect(games.length).toBe(1)
        expect(games[0].teamOne.teamname).toBe('vault')
        // expect(games[1].teamOne.teamname).toBe('pghtemper')
    })

    it('with after value', async () => {
        const games = await services.searchGames(undefined, undefined, new Date('01-01-2021'))
        expect(games.length).toBe(2)
        expect(games[0].teamOne.teamname).toBe('vault')
        expect(games[1].teamOne.teamname).toBe('pghtemper')
    })

    it('with before value', async () => {
        const games = await services.searchGames(undefined, undefined, undefined, new Date('01-01-2021'))
        expect(games.length).toBe(1)
        expect(games[0].teamOne.teamname).toBe('pghtemper')
    })

    it('with all values', async () => {
        const games = await services.searchGames('pghtemper', false, new Date('12-01-2020'), new Date('01-01-2022'))
        expect(games.length).toBe(1)
        expect(games[0].teamOne.teamname).toBe('pghtemper')
    })

    it('with limit', async () => {
        const games = await services.searchGames(undefined, undefined, new Date('01-01-2021'), undefined, 1, 0)
        expect(games.length).toBe(1)
        expect(games[0].teamOne.teamname).toBe('vault')
    })

    it('with offset', async () => {
        const games = await services.searchGames(undefined, undefined, new Date('01-01-2021'), undefined, 1, 1)
        expect(games.length).toBe(1)
        expect(games[0].teamOne.teamname).toBe('pghtemper')
    })

    it('with short value', async () => {
        const games = await services.searchGames('ts')
        expect(games.length).toBe(3)
        expect(games[0].teamOne.teamname).toBe('vault')
        expect(games[1].teamOne.teamname).toBe('pghtemper')
        expect(games[2].teamOne.teamname).toBe('pghtemper')
    })

    it('with partial text', async () => {
        const games = await services.searchGames('tsg')
        expect(games.length).toBe(2)
        expect(games[0].teamOne.teamname).toBe('vault')
        expect(games[1].teamOne.teamname).toBe('pghtemper')
    })

    it('with multiple partial text', async () => {
        const games = await services.searchGames('temp vaul')
        expect(games.length).toBe(3)
        expect(games[0].teamOne.teamname).toBe('vault')
        expect(games[1].teamOne.teamname).toBe('pghtemper')
        expect(games[2].teamOne.teamname).toBe('pghtemper')
    })
})

describe('test get game by team', () => {
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
            _id: teamOneId,
            place: 'Pittsburgh',
            name: 'Temper',
            teamname: 'pghtemper',
        },
        teamTwo: {
            _id: teamThreeId,
            place: 'DC',
            name: 'Truck Stop',
            teamname: 'tsgh',
        },
        startTime: new Date('2021-06-01'),
        teamOneActive: false,
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
        await Game.create(gameThreeData)
    })

    it('with many team one games', async () => {
        const result = await services.getGamesByTeamId(teamOneId.toString())
        expect(result.length).toBe(2)
        expect(result[0]).toMatchObject(gameOneData)
        expect(result[1]).toMatchObject(gameTwoData)
    })

    it('with many team two games', async () => {
        const result = await services.getGamesByTeamId(teamThreeId.toString())
        expect(result.length).toBe(2)
        expect(result[0]).toMatchObject(gameTwoData)
        expect(result[1]).toMatchObject(gameThreeData)
    })

    it('with team one and team two games', async () => {
        const result = await services.getGamesByTeamId(teamTwoId.toString())
        expect(result.length).toBe(2)
        expect(result[0]).toMatchObject(gameOneData)
        expect(result[1]).toMatchObject(gameThreeData)
    })

    it('with no games return', async () => {
        const result = await services.getGamesByTeamId(new Types.ObjectId().toString())
        expect(result.length).toBe(0)
    })

    it('with error', async () => {
        const result = await services.getGamesByTeamId('badid')
        expect(result.length).toBe(0)
    })
})

describe('test create full game', () => {
    it('with valid data', async () => {
        const fullGame: CreateFullGame = {
            ...createData,
            teamOneScore: 2,
            teamTwoScore: 1,
            tournament: {
                _id: new Types.ObjectId(),
                name: 'Tournament',
                eventId: 'tourney',
                startDate: new Date(),
                endDate: new Date(),
                creator: {
                    _id: new Types.ObjectId(),
                    firstName: 'not',
                    lastName: 'real',
                    username: 'test',
                },
            },
            teamOnePlayers: [
                {
                    _id: new Types.ObjectId(),
                    firstName: 'First 1',
                    lastName: 'Last 1',
                    username: 'firstlast1',
                    localGuest: false,
                },
                {
                    _id: new Types.ObjectId(),
                    firstName: 'First 2',
                    lastName: 'Last 2',
                    username: 'firstlast2',
                    localGuest: false,
                },
                {
                    _id: new Types.ObjectId(),
                    firstName: 'First 3',
                    lastName: 'Last 3',
                    username: 'firstlast3',
                    localGuest: false,
                },
                {
                    _id: new Types.ObjectId(),
                    firstName: 'First 4',
                    lastName: 'Last 4',
                    username: 'firstlast4',
                    localGuest: false,
                },
                {
                    _id: new Types.ObjectId(),
                    firstName: 'First 5',
                    lastName: 'Last 5',
                    username: 'firstlast5',
                    localGuest: false,
                },
                {
                    _id: new Types.ObjectId(),
                    firstName: 'First 6',
                    lastName: 'Last 6',
                    username: 'firstlast6',
                    localGuest: false,
                },
                {
                    _id: new Types.ObjectId(),
                    firstName: 'First 7',
                    lastName: 'Last 7',
                    username: 'firstlast7',
                    localGuest: false,
                },
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
                        { _id: new Types.ObjectId(), firstName: 'First 1', lastName: 'Last 1', username: 'firstlast1' },
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
                            actionType: ActionType.CATCH,
                            playerOne: {
                                _id: new Types.ObjectId(),
                                firstName: 'First 1',
                                lastName: 'Last 1',
                                username: 'firstlast1',
                            },
                            playerTwo: {
                                _id: new Types.ObjectId(),
                                firstName: 'First 2',
                                lastName: 'Last 2',
                                username: 'firstlast2',
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
                {
                    pointNumber: 2,
                    teamOneScore: 1,
                    teamTwoScore: 1,
                    pullingTeam: createData.teamOne,
                    receivingTeam: createData.teamTwo,
                    scoringTeam: createData.teamTwo,
                    teamOnePlayers: [
                        { _id: new Types.ObjectId(), firstName: 'First 1', lastName: 'Last 1', username: 'firstlast1' },
                        { _id: new Types.ObjectId(), firstName: 'First 2', lastName: 'Last 2', username: 'firstlast2' },
                        { _id: new Types.ObjectId(), firstName: 'First 3', lastName: 'Last 3', username: 'firstlast3' },
                        { _id: new Types.ObjectId(), firstName: 'First 4', lastName: 'Last 4', username: 'firstlast4' },
                        { _id: new Types.ObjectId(), firstName: 'First 5', lastName: 'Last 5', username: 'firstlast5' },
                        { _id: new Types.ObjectId(), firstName: 'First 6', lastName: 'Last 6', username: 'firstlast6' },
                        { _id: new Types.ObjectId(), firstName: 'First 7', lastName: 'Last 7', username: 'firstlast7' },
                    ],
                    actions: [
                        {
                            actionType: ActionType.PULL,
                            playerOne: {
                                _id: new Types.ObjectId(),
                                firstName: 'First 1',
                                lastName: 'Last 1',
                                username: 'firstlast1',
                            },
                            tags: ['Huck'],
                        },
                        {
                            actionType: ActionType.TEAM_TWO_SCORE,
                            tags: ['Huck'],
                        },
                    ],
                },
                {
                    pointNumber: 3,
                    teamOneScore: 2,
                    teamTwoScore: 1,
                    pullingTeam: createData.teamTwo,
                    receivingTeam: createData.teamOne,
                    scoringTeam: createData.teamOne,
                    teamOnePlayers: [
                        { _id: new Types.ObjectId(), firstName: 'First 1', lastName: 'Last 1', username: 'firstlast1' },
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
                                firstName: 'First 2',
                                lastName: 'Last 2',
                                username: 'firstlast2',
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

        const gameResponse = await services.createFullGame(fullGame, 'jwt')

        expect(gameResponse.teamOnePlayers.length).toBe(7)
        expect(gameResponse.teamOneActive).toBe(false)
        expect(gameResponse.teamTwoActive).toBe(false)
        expect(gameResponse.creator.username).toBe('firstlast')
        expect(gameResponse.teamTwoPlayers.length).toBe(0)
        expect(gameResponse.teamOneScore).toBe(2)
        expect(gameResponse.teamTwoScore).toBe(1)
        expect(gameResponse.points.length).toBe(3)

        const game = await Game.findOne({})
        expect(game?.points.length).toBe(3)
        const [point1, point2, point3] = await Point.find({})
        expect(gameResponse.points[0].toString()).toBe(point1._id.toString())
        expect(point1.teamOneActions.length).toBe(3)
        expect(point1.teamTwoActions.length).toBe(0)
        expect(point1.teamOneScore).toBe(1)
        expect(point1.teamTwoScore).toBe(0)
        expect(gameResponse.points[1].toString()).toBe(point2._id.toString())
        expect(point2.teamOneActions.length).toBe(2)
        expect(point2.teamTwoActions.length).toBe(0)
        expect(point2.teamOneScore).toBe(1)
        expect(point2.teamTwoScore).toBe(1)
        expect(gameResponse.points[2].toString()).toBe(point3._id.toString())
        expect(point3.teamOneActions.length).toBe(2)
        expect(point3.teamTwoActions.length).toBe(0)
        expect(point3.teamOneScore).toBe(2)
        expect(point3.teamTwoScore).toBe(1)
        const actions = await Action.find({})
        expect(actions.length).toBe(7)

        const tournament = await Tournament.findOne()
        expect(tournament).toMatchObject({
            name: 'Tournament',
            eventId: 'tourney',
        })
        expect(tournament?.creator.username).toBe('firstlast')
    })

    it('with found tournament', async () => {
        const fullGame: CreateFullGame = {
            ...createData,
            teamOneScore: 2,
            teamTwoScore: 1,
            tournament: {
                _id: new Types.ObjectId(),
                name: 'Tournament',
                eventId: 'tourney',
                startDate: new Date(),
                endDate: new Date(),
                creator: {
                    _id: new Types.ObjectId(),
                    firstName: 'not',
                    lastName: 'real',
                    username: 'test',
                },
            },
            teamOnePlayers: [
                {
                    _id: new Types.ObjectId(),
                    firstName: 'First 1',
                    lastName: 'Last 1',
                    username: 'firstlast1',
                    localGuest: false,
                },
                {
                    _id: new Types.ObjectId(),
                    firstName: 'First 2',
                    lastName: 'Last 2',
                    username: 'firstlast2',
                    localGuest: false,
                },
                {
                    _id: new Types.ObjectId(),
                    firstName: 'First 3',
                    lastName: 'Last 3',
                    username: 'firstlast3',
                    localGuest: false,
                },
                {
                    _id: new Types.ObjectId(),
                    firstName: 'First 4',
                    lastName: 'Last 4',
                    username: 'firstlast4',
                    localGuest: false,
                },
                {
                    _id: new Types.ObjectId(),
                    firstName: 'First 5',
                    lastName: 'Last 5',
                    username: 'firstlast5',
                    localGuest: false,
                },
                {
                    _id: new Types.ObjectId(),
                    firstName: 'First 6',
                    lastName: 'Last 6',
                    username: 'firstlast6',
                    localGuest: false,
                },
                {
                    _id: new Types.ObjectId(),
                    firstName: 'First 7',
                    lastName: 'Last 7',
                    username: 'firstlast7',
                    localGuest: false,
                },
            ],
            points: [],
        }

        const realTourney = await Tournament.create({
            name: 'Tournament',
            eventId: 'tourney',
            startDate: new Date(),
            endDate: new Date(),
            creator: {
                _id: new Types.ObjectId(),
                firstName: 'not',
                lastName: 'real',
                username: 'test',
            },
        })

        const gameResponse = await services.createFullGame(fullGame, 'jwt')

        expect(gameResponse.tournament?._id.toHexString()).toBe(realTourney._id.toHexString())

        const tournaments = await Tournament.find()
        expect(tournaments.length).toBe(1)
    })
})

describe('test open', () => {
    it('with found game', async () => {
        const game = await Game.create(gameData)

        const result = await services.open(game._id.toHexString())

        expect(result.totalViews).toBe(1)

        const gameRecord = await Game.findOne({})
        expect(gameRecord?.totalViews).toBe(1)
    })

    it('with multiple calls', async () => {
        const game = await Game.create(gameData)

        const promises: Promise<unknown>[] = []
        for (let i = 0; i < 100; i++) {
            promises.push(services.open(game._id.toHexString()))
        }
        await Promise.all(promises)

        const gameRecord = await Game.findOne({})
        expect(gameRecord?.totalViews).toBe(100)
    })

    it('with unfound game', async () => {
        await expect(services.open(new Types.ObjectId().toString())).rejects.toThrowError(
            new ApiError(Constants.UNABLE_TO_FIND_GAME, 404),
        )
    })
})

describe('test rebuild full stats for game', () => {
    const team: Team = {
        _id: new Types.ObjectId(),
        seasonStart: new Date(),
        seasonEnd: new Date(),
        place: 'Place 1',
        name: 'Name 1',
        teamname: 'placename',
    }
    const gameId = new Types.ObjectId()
    beforeEach(async () => {
        jest.resetAllMocks()

        const pointOneId = new Types.ObjectId()
        const pointTwoId = new Types.ObjectId()
        const pointThreeId = new Types.ObjectId()

        const action1 = await Action.create({
            team,
            actionNumber: 1,
            actionType: 'TeamOneScore',
            pointId: pointOneId,
        })
        const action2 = await Action.create({
            team,
            actionNumber: 1,
            actionType: 'Pull',
            pointId: pointTwoId,
        })
        const action3 = await Action.create({
            team,
            actionNumber: 2,
            actionType: 'TeamOneScore',
            pointId: pointThreeId,
        })

        await Point.create({
            _id: pointOneId,
            gameId,
            pointNumber: 1,
            pullingTeam: { name: 'Team 1' },
            receivingTeam: { name: 'Team 2' },
            teamOneScore: 0,
            teamTwoScore: 1,
            teamOneActions: [action1._id],
            teamOneActive: false,
            teamTwoActive: false,
        })
        await Point.create({
            _id: pointTwoId,
            gameId,
            pointNumber: 2,
            pullingTeam: { name: 'Team 2' },
            receivingTeam: { name: 'Team 1' },
            teamOneScore: 1,
            teamTwoScore: 1,
            teamOneActions: [action2._id],
            teamOneActive: false,
            teamTwoActive: false,
        })
        await Point.create({
            _id: pointThreeId,
            gameId,
            pointNumber: 3,
            pullingTeam: { name: 'Team 1' },
            receivingTeam: { name: 'Team 2' },
            teamOneScore: 1,
            teamTwoScore: 2,
            teamOneActions: [action3._id],
            teamOneActive: true,
            teamTwoActive: true,
        })
    })

    it('handles success with team one and finished game', async () => {
        const cloudTaskSpy = jest
            .spyOn(CloudTaskServices, 'sendCloudTask')
            .mockReturnValue(Promise.resolve([] as never))
        const [point1, point2, point3] = await Point.find()
        const game = await Game.create({ ...createData, _id: gameId })
        game.points = [point1._id, point2._id, point3._id]
        game.teamOneActive = false
        game.teamOneStatus = GameStatus.COMPLETE
        game.teamTwoActive = false
        game.teamTwoStatus = GameStatus.GUEST
        await game.save()

        await services.rebuildStatsForGame(game._id.toHexString(), game.teamOne._id?.toHexString() as string)

        expect(cloudTaskSpy).toBeCalledTimes(5)
    })

    it('handles unfound game', async () => {
        const cloudTaskSpy = jest
            .spyOn(CloudTaskServices, 'sendCloudTask')
            .mockReturnValue(Promise.resolve([] as never))

        await expect(
            services.rebuildStatsForGame(new Types.ObjectId().toHexString(), new Types.ObjectId().toHexString()),
        ).rejects.toThrow(Constants.UNABLE_TO_FIND_GAME)

        expect(cloudTaskSpy).not.toHaveBeenCalled()
    })

    it('handles team id does not belong to game', async () => {
        const cloudTaskSpy = jest
            .spyOn(CloudTaskServices, 'sendCloudTask')
            .mockReturnValue(Promise.resolve([] as never))
        const game = await Game.create({ ...createData, _id: gameId })

        await expect(
            services.rebuildStatsForGame(game._id.toHexString(), new Types.ObjectId().toHexString()),
        ).rejects.toThrow(Constants.INVALID_DATA)

        expect(cloudTaskSpy).not.toHaveBeenCalled()
    })

    it('handles success unfound point and team two', async () => {
        const cloudTaskSpy = jest
            .spyOn(CloudTaskServices, 'sendCloudTask')
            .mockReturnValue(Promise.resolve([] as never))

        const teamTwoId = new Types.ObjectId()

        const [point1, point3] = await Point.find()
        const game = await Game.create({
            ...createData,
            _id: gameId,
            teamTwo: { _id: teamTwoId, place: 'Test', name: 'Test' },
        })
        game.points = [point1._id, new Types.ObjectId(), point3._id]
        await game.save()

        await services.rebuildStatsForGame(game._id.toHexString(), game.teamTwo._id?.toHexString() as string)

        expect(cloudTaskSpy).toBeCalledTimes(3)
    })
})

describe('test update game players for team', () => {
    it('with valid data for team one', async () => {
        const game = await Game.create(gameData)

        const id = new Types.ObjectId()
        const player = {
            _id: id,
            firstName: 'Noah',
            lastName: 'Celuch',
            username: 'noah',
        }
        jest.spyOn(UltmtUtils, 'getTeam').mockReturnValue(Promise.resolve({ players: [player] } as TeamResponse))

        const gameResult = await services.updateGamePlayers(game._id.toString(), TeamNumber.ONE)

        expect(gameResult.teamOnePlayers.length).toBe(1)
        expect(gameResult.teamOnePlayers[0]._id.toHexString()).toBe(id.toHexString())
        expect(gameResult.teamOnePlayers[0].firstName).toBe('Noah')
        expect(gameResult.teamOnePlayers[0].lastName).toBe('Celuch')
        expect(gameResult.teamOnePlayers[0].username).toBe('noah')

        const gameRecord = await Game.findById(game._id)
        expect(gameRecord?.teamOnePlayers.length).toBe(1)
        expect(gameRecord?.teamOnePlayers[0]._id.toHexString()).toBe(id.toHexString())
        expect(gameRecord?.teamOnePlayers[0].firstName).toBe('Noah')
        expect(gameRecord?.teamOnePlayers[0].lastName).toBe('Celuch')
        expect(gameRecord?.teamOnePlayers[0].username).toBe('noah')
    })

    it('with valid data for team two', async () => {
        const game = await Game.create(gameData)
        game.teamTwoActive = true
        game.teamTwoDefined = true
        game.teamTwoStatus = GameStatus.ACTIVE
        await game.save()

        const id = new Types.ObjectId()
        const player = {
            _id: id,
            firstName: 'Noah',
            lastName: 'Celuch',
            username: 'noah',
        }
        jest.spyOn(UltmtUtils, 'getTeam').mockReturnValue(Promise.resolve({ players: [player] } as TeamResponse))

        const gameResult = await services.updateGamePlayers(game._id.toString(), TeamNumber.TWO)

        expect(gameResult.teamTwoPlayers.length).toBe(1)
        expect(gameResult.teamTwoPlayers[0]._id.toHexString()).toBe(id.toHexString())
        expect(gameResult.teamTwoPlayers[0].firstName).toBe('Noah')
        expect(gameResult.teamTwoPlayers[0].lastName).toBe('Celuch')
        expect(gameResult.teamTwoPlayers[0].username).toBe('noah')

        const gameRecord = await Game.findById(game._id)
        expect(gameRecord?.teamTwoPlayers.length).toBe(1)
        expect(gameRecord?.teamTwoPlayers[0]._id.toHexString()).toBe(id.toHexString())
        expect(gameRecord?.teamTwoPlayers[0].firstName).toBe('Noah')
        expect(gameRecord?.teamTwoPlayers[0].lastName).toBe('Celuch')
        expect(gameRecord?.teamTwoPlayers[0].username).toBe('noah')
    })

    it('with unfound game', async () => {
        await Game.create(gameData)

        await expect(services.updateGamePlayers(new Types.ObjectId().toString(), TeamNumber.ONE)).rejects.toThrowError(
            new ApiError(Constants.UNABLE_TO_FIND_GAME, 404),
        )
    })

    it('with unable to add player', async () => {
        const game = await Game.create(gameData)

        await expect(services.updateGamePlayers(game._id.toString(), TeamNumber.TWO)).rejects.toThrowError(
            new ApiError(Constants.UNABLE_TO_ADD_PLAYER, 400),
        )
    })
})
