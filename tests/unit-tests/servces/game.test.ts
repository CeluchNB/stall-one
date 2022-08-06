import { setUpDatabase, tearDownDatabase, createData, resetDatabase } from '../../fixtures/setup-db'
import GameServices from '../../../src/services/v1/game'
import Game from '../../../src/models/game'
import { ApiError } from '../../../src/types/errors'
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
const fetchMock = jest.fn(() => {
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
        status: 200,
    })
}) as jest.Mock

describe('test create game', () => {
    it('with valid data', async () => {
        global.fetch = fetchMock
        const game = await services.createGame(createData, '')

        const gameRecord = await Game.findById(game._id)
        expect(game._id.toString()).toBe(gameRecord?._id.toString())
        expect(game.teamOneScore).toBe(0)
        expect(game.teamTwoScore).toBe(0)
        expect(game.teamTwoResolved).toBe(false)
        expect(gameRecord?.completeGame).toBe(false)
        expect(gameRecord?.creator.username).toBe('firstlast')
        fetchMock.mockClear()
    })

    it('with fetch error', async () => {
        fetchMock.mockImplementationOnce(() => Promise.resolve({ status: 401 }))
        global.fetch = fetchMock
        expect(services.createGame(createData, '')).rejects.toThrowError(
            new ApiError('Unable to authenticate user', 401),
        )

        const games = await Game.find({})
        expect(games.length).toBe(0)
    })
})
