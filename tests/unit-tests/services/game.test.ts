import * as Constants from '../../../src/utils/constants'
import { setUpDatabase, tearDownDatabase, createData, resetDatabase } from '../../fixtures/setup-db'
import GameServices from '../../../src/services/v1/game'
import Game from '../../../src/models/game'
import { ApiError } from '../../../src/types/errors'
import { CreateGame } from '../../../src/types/game'
import { Types } from 'mongoose'

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
const fetchMock = jest.fn((url) => {
    if (url.includes('manager/authenticate')) {
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
    } else if (url.includes('v1/team')) {
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
    }
}) as jest.Mock

describe('test create game', () => {
    afterEach(() => {
        fetchMock.mockClear()
    })

    it('with valid data and team two not resolved', async () => {
        global.fetch = fetchMock
        const game = await services.createGame(createData, '')

        const gameRecord = await Game.findById(game._id)
        expect(game._id.toString()).toBe(gameRecord?._id.toString())
        expect(game.teamOneScore).toBe(0)
        expect(game.teamTwoScore).toBe(0)
        expect(game.teamTwoResolved).toBe(false)
        expect(gameRecord?.completeGame).toBe(false)
        expect(gameRecord?.creator.username).toBe('firstlast')
        expect(gameRecord?.teamOnePlayers.length).toBe(2)
        expect(gameRecord?.teamTwoPlayers.length).toBe(0)
    })

    it('with valid data and team two resolved', async () => {
        global.fetch = fetchMock
        const game = await services.createGame({ ...createData, teamTwoResolved: true }, '')

        const gameRecord = await Game.findById(game._id)
        expect(game._id.toString()).toBe(gameRecord?._id.toString())
        expect(game.teamOneScore).toBe(0)
        expect(game.teamTwoScore).toBe(0)
        expect(game.teamTwoResolved).toBe(true)
        expect(gameRecord?.completeGame).toBe(false)
        expect(gameRecord?.creator.username).toBe('firstlast')
        expect(gameRecord?.teamOnePlayers.length).toBe(2)
        expect(gameRecord?.teamTwoPlayers.length).toBe(2)
    })

    it('with fetch error', async () => {
        fetchMock.mockImplementationOnce(() => Promise.resolve({ status: 401 }))
        global.fetch = fetchMock
        expect(services.createGame(createData, '')).rejects.toThrowError(
            new ApiError(Constants.UNAUTHENTICATED_USER, 401),
        )

        const games = await Game.find({})
        expect(games.length).toBe(0)
    })

    it('with unfound team one', async () => {
        fetchMock.mockImplementationOnce(() => {
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
        fetchMock.mockImplementationOnce(() => {
            return Promise.resolve({ ok: false })
        })
        global.fetch = fetchMock

        expect(services.createGame(createData, '')).rejects.toThrowError(
            new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 404),
        )
        const games = await Game.find({})
        expect(games.length).toBe(0)
    })

    it('with unfound team two', async () => {
        fetchMock.mockImplementationOnce(() => {
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
        fetchMock.mockImplementationOnce(() => {
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
        fetchMock.mockImplementationOnce(() => {
            return Promise.resolve({ ok: false })
        })
        global.fetch = fetchMock

        expect(services.createGame({ ...createData, teamTwoResolved: true }, '')).rejects.toThrowError(
            new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 404),
        )
        const games = await Game.find({})
        expect(games.length).toBe(0)
    })

    it('with unsafe data', async () => {
        global.fetch = fetchMock
        const game = await services.createGame(
            {
                ...createData,
                teamOnePlayers: ['player 1', 'player 2', 'player 5', 'player 6'],
                teamTwoPlayers: ['player 3', 'player 4'],
                token: 'token1',
                teamOneScore: 21,
                teamTwoScore: -99,
                joinOtp: ['123456'],
            } as CreateGame,
            '',
        )

        const gameRecord = await Game.findById(game._id)
        expect(game._id.toString()).toBe(gameRecord?._id.toString())
        expect(game.teamOneScore).toBe(0)
        expect(game.teamTwoScore).toBe(0)
        expect(game.teamTwoResolved).toBe(false)
        expect(gameRecord?.completeGame).toBe(false)
        expect(gameRecord?.creator.username).toBe('firstlast')
        expect(gameRecord?.teamOnePlayers.length).toBe(2)
        expect(gameRecord?.teamTwoPlayers.length).toBe(0)
        expect(gameRecord?.token).toBe(undefined)
        expect(gameRecord?.teamOneScore).toBe(0)
        expect(gameRecord?.teamTwoScore).toBe(0)
        expect(gameRecord?.joinOtp.length).toBe(0)
    })
})
