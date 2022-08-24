import * as Constants from '../../../src/utils/constants'
import { setUpDatabase, tearDownDatabase, createData, gameData, getMock, resetDatabase } from '../../fixtures/setup-db'
import GameServices from '../../../src/services/v1/game'
import Game from '../../../src/models/game'
import { ApiError } from '../../../src/types/errors'
import { CreateGame } from '../../../src/types/game'
import { TeamNumber } from '../../../src/types/ultmt'
import { Types } from 'mongoose'
import jwt from 'jsonwebtoken'
import axios from 'axios'
import randomstring from 'randomstring'

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
        expect(game.teamTwoResolved).toBe(false)
        expect(game.teamTwoDefined).toBe(false)
        expect(token.length).toBeGreaterThan(20)
        expect(gameRecord?.completeGame).toBe(false)
        expect(gameRecord?.creator.username).toBe('firstlast')
        expect(gameRecord?.teamOnePlayers.length).toBe(2)
        expect(gameRecord?.teamTwoPlayers.length).toBe(0)
    })

    it('with valid data and team two resolved', async () => {
        const { game, token } = await services.createGame({ ...createData, teamTwoDefined: true }, '')

        const gameRecord = await Game.findById(game._id)
        expect(game._id.toString()).toBe(gameRecord?._id.toString())
        expect(game.teamOneScore).toBe(0)
        expect(game.teamTwoScore).toBe(0)
        expect(game.teamTwoResolved).toBe(false)
        expect(game.teamTwoDefined).toBe(true)
        expect(token.length).toBeGreaterThan(20)
        expect(gameRecord?.completeGame).toBe(false)
        expect(gameRecord?.creator.username).toBe('firstlast')
        expect(gameRecord?.teamOnePlayers.length).toBe(2)
        expect(gameRecord?.teamTwoPlayers.length).toBe(2)
        expect(token).toBe(gameRecord?.teamOneToken)
        expect(gameRecord?.teamTwoToken).toBeUndefined()
    })

    it('with fetch error', async () => {
        getMock.mockImplementationOnce(() => Promise.resolve({ status: 401 }))
        expect(services.createGame(createData, '')).rejects.toThrowError(
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

        expect(services.createGame(createData, '')).rejects.toThrowError(
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

        expect(services.createGame({ ...createData, teamTwoDefined: true }, '')).rejects.toThrowError(
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
                teamTwoResolved: true,
            } as CreateGame,
            '',
        )

        const gameRecord = await Game.findById(game._id)
        expect(game._id.toString()).toBe(gameRecord?._id.toString())
        expect(game.teamOneScore).toBe(0)
        expect(game.teamTwoScore).toBe(0)
        expect(game.teamTwoResolved).toBe(false)
        expect(token.length).toBeGreaterThan(20)
        expect(gameRecord?.completeGame).toBe(false)
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
        expect(services.createGame(createData, '')).rejects.toThrowError(Constants.GENERIC_ERROR)
    })
})

describe('test edit game', () => {
    it('should update with valid data and no team 2', async () => {
        const game = await Game.create(gameData)

        const updatedGame = await services.updateGame(game._id.toString(), {
            timeoutPerHalf: 10,
            liveGame: false,
            floaterTimeout: false,
        })

        expect(updatedGame.liveGame).toBe(false)
        expect(updatedGame.floaterTimeout).toBe(false)
        expect(updatedGame.teamTwoResolved).toBe(false)

        const gameRecord = await Game.findById(game._id)
        expect(gameRecord?.liveGame).toBe(false)
        expect(gameRecord?.floaterTimeout).toBe(false)
        expect(gameRecord?.timeoutPerHalf).toBe(10)
        expect(gameRecord?.teamTwoResolved).toBe(false)
        expect(gameRecord?.teamTwoDefined).toBe(false)
    })

    it('should update with valid data and team 2', async () => {
        const game = await Game.create(gameData)

        const updatedGame = await services.updateGame(game._id.toString(), {
            ...createData,
            timeoutPerHalf: 0,
            teamTwo: { _id: new Types.ObjectId(), place: 'Place 2', name: 'Name 2', teamname: 'place2name2' },
            teamTwoDefined: true,
        })

        expect(updatedGame.teamTwoResolved).toBe(false)
        expect(updatedGame.teamTwoDefined).toBe(true)
        expect(updatedGame.teamTwo?.place).toBe('Place 2')
        expect(updatedGame.teamTwoPlayers.length).toBe(2)
        expect(updatedGame.liveGame).toBe(true)

        const gameRecord = await Game.findById(updatedGame._id)
        expect(gameRecord?.teamTwoResolved).toBe(false)
        expect(gameRecord?.teamTwoDefined).toBe(true)
        expect(gameRecord?.teamTwoPlayers.length).toBe(2)
        expect(gameRecord?.liveGame).toBe(true)
    })

    it('with unfound game', async () => {
        await Game.create(gameData)

        expect(
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
        expect(
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
        expect(token).toBe(gameRecord?.teamTwoToken)
        expect(game._id).toEqual(initialGame._id)
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

        expect(
            services.teamTwoJoinGame(
                new Types.ObjectId().toString(),
                initialGame.teamTwo._id?.toString() || '',
                'asdf1234.asdf145radsf.ad43grad',
                initialGame.resolveCode,
            ),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FIND_GAME, 404))

        const gameRecord = await Game.findById(initialGame._id)
        expect(gameRecord?.teamTwoResolved).toBe(false)
        expect(gameRecord?.teamTwoToken).toBe(undefined)
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

        expect(
            services.teamTwoJoinGame(
                initialGame._id.toString(),
                initialGame.teamTwo._id?.toString() || '',
                'asdf1234.asdf145radsf.ad43grad',
                initialGame.resolveCode,
            ),
        ).rejects.toThrowError(new ApiError(Constants.UNAUTHENTICATED_USER, 401))

        const gameRecord = await Game.findById(initialGame._id)
        expect(gameRecord?.teamTwoResolved).toBe(false)
        expect(gameRecord?.teamTwoToken).toBe(undefined)
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

        expect(
            services.teamTwoJoinGame(
                initialGame._id.toString(),
                initialGame.teamTwo._id?.toString() || '',
                'asdf1234.asdf145radsf.ad43grad',
                initialGame.resolveCode,
            ),
        ).rejects.toThrowError(new ApiError(Constants.UNAUTHENTICATED_USER, 401))

        const gameRecord = await Game.findById(initialGame._id)
        expect(gameRecord?.teamTwoResolved).toBe(false)
        expect(gameRecord?.teamTwoToken).toBe(undefined)
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

        expect(
            services.teamTwoJoinGame(
                initialGame._id.toString(),
                initialGame.teamTwo._id?.toString() || '',
                'asdf1234.asdf145radsf.ad43grad',
                '654321',
            ),
        ).rejects.toThrowError(new ApiError(Constants.WRONG_RESOLVE_CODE, 401))

        const gameRecord = await Game.findById(initialGame._id)
        expect(gameRecord?.teamTwoResolved).toBe(false)
        expect(gameRecord?.teamTwoToken).toBe(undefined)
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
        game.teamTwoResolved = true
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

        expect(
            services.addGuestPlayer(new Types.ObjectId().toString(), TeamNumber.ONE, {
                firstName: 'Noah',
                lastName: 'Celuch',
            }),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FIND_GAME, 404))
    })

    it('with unable to add player', async () => {
        const game = await Game.create(gameData)

        expect(
            services.addGuestPlayer(game._id.toString(), TeamNumber.TWO, {
                firstName: 'Noah',
                lastName: 'Celuch',
            }),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_ADD_PLAYER, 400))
    })
})
