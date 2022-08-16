import * as Constants from '../../../src/utils/constants'
import { setUpDatabase, tearDownDatabase, createData, gameData, getMock, resetDatabase } from '../../fixtures/setup-db'
import GameServices from '../../../src/services/v1/game'
import Game from '../../../src/models/game'
import { ApiError } from '../../../src/types/errors'
import { CreateGame } from '../../../src/types/game'
import { Types } from 'mongoose'
import jwt from 'jsonwebtoken'
import axios from 'axios'

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
        expect(token.length).toBeGreaterThan(20)
        expect(gameRecord?.completeGame).toBe(false)
        expect(gameRecord?.creator.username).toBe('firstlast')
        expect(gameRecord?.teamOnePlayers.length).toBe(2)
        expect(gameRecord?.teamTwoPlayers.length).toBe(0)
    })

    it('with valid data and team two resolved', async () => {
        const { game, token } = await services.createGame({ ...createData, teamTwoResolved: true }, '')

        const gameRecord = await Game.findById(game._id)
        expect(game._id.toString()).toBe(gameRecord?._id.toString())
        expect(game.teamOneScore).toBe(0)
        expect(game.teamTwoScore).toBe(0)
        expect(game.teamTwoResolved).toBe(true)
        expect(token.length).toBeGreaterThan(20)
        expect(gameRecord?.completeGame).toBe(false)
        expect(gameRecord?.creator.username).toBe('firstlast')
        expect(gameRecord?.teamOnePlayers.length).toBe(2)
        expect(gameRecord?.teamTwoPlayers.length).toBe(2)
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

        expect(services.createGame({ ...createData, teamTwoResolved: true }, '')).rejects.toThrowError(
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
            ...createData,
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
        expect(gameRecord?.teamTwoResolved).toBe(false)
    })

    it('should update with valid data and team 2', async () => {
        const game = await Game.create(gameData)

        const updatedGame = await services.updateGame(game._id.toString(), {
            ...createData,
            timeoutPerHalf: 0,
            teamTwo: { _id: new Types.ObjectId(), place: 'Place 2', name: 'Name 2', teamname: 'place2name2' },
            teamTwoResolved: true,
        })

        expect(updatedGame.teamTwoResolved).toBe(true)
        expect(updatedGame.teamTwo.place).toBe('Place 2')
        expect(updatedGame.teamTwoPlayers.length).toBe(2)
        expect(updatedGame.liveGame).toBe(true)

        const gameRecord = await Game.findById(updatedGame._id)
        expect(gameRecord?.teamTwoResolved).toBe(true)
        expect(gameRecord?.teamTwoPlayers.length).toBe(2)
        expect(gameRecord?.liveGame).toBe(true)
    })

    it('with unfound team', async () => {
        await Game.create(gameData)

        expect(
            services.updateGame(new Types.ObjectId().toString(), {
                ...createData,
                teamTwo: { _id: new Types.ObjectId(), place: 'Place 2', name: 'Name 2', teamname: 'place2name2' },
                teamTwoResolved: true,
            }),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 404))
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
                teamTwoResolved: true,
            }),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 404))
    })
})
