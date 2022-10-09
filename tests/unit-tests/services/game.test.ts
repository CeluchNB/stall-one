import * as Constants from '../../../src/utils/constants'
import { setUpDatabase, tearDownDatabase, createData, gameData, getMock, resetDatabase } from '../../fixtures/setup-db'
import GameServices from '../../../src/services/v1/game'
import Game from '../../../src/models/game'
import { ApiError } from '../../../src/types/errors'
import { CreateGame } from '../../../src/types/game'
import { TeamNumber } from '../../../src/types/ultmt'
import { Types } from 'mongoose'
import jwt, { JwtPayload } from 'jsonwebtoken'
import axios from 'axios'
import randomstring from 'randomstring'
import Tournament from '../../../src/models/tournament'
import { CreateTournament } from '../../../src/types/tournament'

beforeAll(async () => {
    await setUpDatabase()
})

afterAll(async () => {
    await tearDownDatabase()
})

afterEach(async () => {
    await resetDatabase()
})

const services = new GameServices(Game, '', '')

jest.spyOn(axios, 'get').mockImplementation(getMock)

describe('test create game', () => {
    it('with valid data and team two not resolved', async () => {
        const { game, token } = await services.createGame(createData, '')

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
        expect(payload.exp).toBe(Math.floor(new Date().getTime() / 1000) + 60 * 60 * 3)
    })

    it('with valid data and team two resolved', async () => {
        const tournamentId = new Types.ObjectId()
        const { game, token } = await services.createGame(
            {
                ...createData,
                teamTwoDefined: true,
                tournament: {
                    _id: tournamentId,
                    startDate: new Date('09-22-2022'),
                    endDate: new Date('09-23-2022'),
                    name: 'Mid-Atlantic Regionals 2022',
                    eventId: 'mareg22',
                },
            },
            '',
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
        await expect(services.createGame(createData, '')).rejects.toThrowError(
            new ApiError(Constants.UNAUTHENTICATED_USER, 401),
        )

        const games = await Game.find({})
        expect(games.length).toBe(0)
    })

    it('with unfound team one', async () => {
        getMock.mockImplementationOnce(() => {
            return Promise.resolve({
                json: () =>
                    Promise.resolve({
                        user: {
                            _id: new Types.ObjectId(),
                            firstName: 'first',
                            lastName: 'last',
                            username: 'firstlast',
                        },
                    }),
                ok: true,
                status: 200,
            })
        })
        getMock.mockImplementationOnce(() => {
            return Promise.resolve({ ok: false })
        })

        await expect(services.createGame(createData, '')).rejects.toThrowError(
            new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 404),
        )
        const games = await Game.find({})
        expect(games.length).toBe(0)
    })

    it('with unfound team two', async () => {
        getMock.mockImplementationOnce(() => {
            return Promise.resolve({
                json: () =>
                    Promise.resolve({
                        user: {
                            _id: new Types.ObjectId(),
                            firstName: 'first',
                            lastName: 'last',
                            username: 'firstlast',
                        },
                    }),
                ok: true,
                status: 200,
            })
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
        getMock.mockImplementationOnce(() => {
            return Promise.resolve({ ok: false })
        })

        await expect(services.createGame({ ...createData, teamTwoDefined: true }, '')).rejects.toThrowError(
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
            '',
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
        expect(services.createGame(createData, '')).rejects.toThrowError('bad message')
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
        expect(payload.exp).toBe(Math.floor(new Date().getTime() / 1000) + 60 * 60 * 3)
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
