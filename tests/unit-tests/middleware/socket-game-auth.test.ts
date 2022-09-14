import * as Constants from '../../../src/utils/constants'
import { gameAuth } from '../../../src/middlware/socket-game-auth'
import { setUpDatabase, tearDownDatabase, resetDatabase, createData } from '../../fixtures/setup-db'
import Game from '../../../src/models/game'
import { Socket } from 'socket.io'
import jwt from 'jsonwebtoken'

beforeAll(async () => {
    await setUpDatabase()
})

afterAll(async () => {
    await tearDownDatabase()
})

afterEach(async () => {
    await resetDatabase()
})

describe('test game auth method', () => {
    it('should work with valid token', async () => {
        const game = await Game.create(createData)
        const token = game.teamOneToken

        const next = jest.fn()
        const socket = { data: {}, request: { headers: { authorization: `Bearer ${token}` } } } as Socket
        await gameAuth(socket, next)
        expect(socket.data.gameId).toBe(game._id.toString())
        expect(next).toHaveBeenCalled()
    })

    it('should fail with unfound token', async () => {
        const next = jest.fn()
        const socket = { data: {}, request: { headers: {} } } as Socket
        await gameAuth(socket, next)
        expect(next).toHaveBeenCalledWith(new Error(Constants.UNAUTHENTICATED_USER))
    })

    it('should fail with unfound game', async () => {
        const badToken = jwt.sign({ testId: '1234' }, process.env.JWT_SECRET as string)
        const next = jest.fn()
        const socket = {
            data: {},
            request: {
                headers: {
                    authorization: `Bearer ${badToken}`,
                },
            },
        } as Socket
        await gameAuth(socket, next)
        expect(next).toHaveBeenCalledWith(new Error(Constants.UNABLE_TO_FIND_GAME))
    })

    it('should fail with bad token', async () => {
        const next = jest.fn()
        const socket = {
            data: {},
            request: {
                headers: {
                    authorization:
                        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
                },
            },
        } as Socket
        await gameAuth(socket, next)
        expect(next).toHaveBeenCalledWith(new Error(Constants.UNAUTHENTICATED_USER))
    })

    it('should fail with malformed token', async () => {
        const next = jest.fn()
        const socket = {
            data: {},
            request: {
                headers: {
                    authorization: 'Bearer asdf.123radsf.g542qefds',
                },
            },
        } as Socket
        await gameAuth(socket, next)
        expect(next).toHaveBeenCalledWith(new Error(Constants.UNAUTHENTICATED_USER))
    })
})
