import * as Constants from '../../../src/utils/constants'
import app, { close } from '../../../src/app'
import { resetDatabase, createData, client, setUpDatabase, tearDownDatabase } from '../../fixtures/setup-db'
import ioClient from 'socket.io-client'
import { ActionType, ClientAction } from '../../../src/types/action'
import { Types } from 'mongoose'
import Game from '../../../src/models/game'
import * as RedisUtils from '../../../src/utils/redis'

let clientSocket: ReturnType<typeof ioClient>
beforeAll((done) => {
    app.listen(process.env.PORT, () => {
        Game.create(createData, (error, game) => {
            clientSocket = ioClient(`http://localhost:${process.env.PORT}/live`, {
                extraHeaders: { authorization: `Bearer ${game.teamOneToken}` },
            })
            clientSocket.on('connect', () => {
                done()
            })
        })
    })
})
beforeAll(async () => {
    await setUpDatabase()
})

afterEach(async () => {
    await resetDatabase()
    clientSocket.removeAllListeners()
})

afterAll(async () => {
    await close()
    await tearDownDatabase()
    clientSocket.close()
    app.close()
})

describe('test client action sent', () => {
    it('with valid data', (done) => {
        const actionData: ClientAction = {
            pointId: new Types.ObjectId().toString(),
            actionType: ActionType.PULL,
            team: {
                _id: new Types.ObjectId(),
                place: 'Pittsburgh',
                name: 'Temper',
                teamname: 'pghtemper',
                seasonStart: new Date('2022'),
                seasonEnd: new Date('2022'),
            },
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            tags: ['IB'],
        }
        clientSocket.on('action', (action) => {
            expect(action.pointId).toBe(actionData.pointId)
            expect(action.actionNumber).toBe(1)
            expect(action.actionType).toBe(ActionType.PULL)
            expect(action.team.teamname).toBe(actionData.team.teamname)
            expect(action.playerOne.username).toBe(actionData.playerOne?.username)
            done()
        })
        clientSocket.emit('action:client', JSON.stringify(actionData))
    })

    it('with bad data', (done) => {
        const actionData = {
            pointId: new Types.ObjectId().toString(),
            team: {
                _id: new Types.ObjectId(),
                place: 'Pittsburgh',
                name: 'Temper',
                teamname: 'pghtemper',
                seasonStart: new Date('2022'),
                seasonEnd: new Date('2022'),
            },
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            tags: ['IB'],
        }
        clientSocket.on('action:error', (error) => {
            expect(error.message).toBe(Constants.INVALID_DATA)
            done()
        })
        clientSocket.emit('action:client', JSON.stringify(actionData))
    })

    it('with non object exception', (done) => {
        jest.spyOn(RedisUtils, 'saveRedisAction').mockImplementationOnce(() => {
            throw 7
        })
        const actionData: ClientAction = {
            pointId: new Types.ObjectId().toString(),
            actionType: ActionType.PULL,
            team: {
                _id: new Types.ObjectId(),
                place: 'Pittsburgh',
                name: 'Temper',
                teamname: 'pghtemper',
                seasonStart: new Date('2022'),
                seasonEnd: new Date('2022'),
            },
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            tags: ['IB'],
        }
        clientSocket.on('action:error', (error) => {
            expect(error.message).toBe(Constants.GENERIC_ERROR)
            done()
        })
        clientSocket.emit('action:client', JSON.stringify(actionData))
    })
})

describe('test server action', () => {
    it('with valid data', (done) => {
        const actionData: ClientAction = {
            pointId: new Types.ObjectId().toString(),
            actionType: ActionType.PULL,
            team: {
                _id: new Types.ObjectId(),
                place: 'Pittsburgh',
                name: 'Temper',
                teamname: 'pghtemper',
                seasonStart: new Date('2022'),
                seasonEnd: new Date('2022'),
            },
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            tags: ['IB'],
        }
        Promise.resolve(
            RedisUtils.saveRedisAction(client, {
                ...actionData,
                actionNumber: 1,
                displayMessage: 'Pull',
                comments: [],
                pointId: new Types.ObjectId(actionData.pointId),
            }),
        ).then(() => {
            clientSocket.on('action', (action) => {
                expect(action.pointId.toString()).toBe(actionData.pointId.toString())
                expect(action.actionType).toBe(actionData.actionType)
                done()
            })
            clientSocket.emit('action:server', JSON.stringify({ pointId: actionData.pointId, number: 1 }))
        })
    })

    it('with invalid data', (done) => {
        const actionData: ClientAction = {
            pointId: new Types.ObjectId().toString(),
            actionType: ActionType.PULL,
            team: {
                _id: new Types.ObjectId(),
                place: 'Pittsburgh',
                name: 'Temper',
                teamname: 'pghtemper',
                seasonStart: new Date('2022'),
                seasonEnd: new Date('2022'),
            },
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            tags: ['IB'],
        }
        Promise.resolve(
            RedisUtils.saveRedisAction(client, {
                ...actionData,
                actionNumber: 1,
                displayMessage: 'Pull',
                comments: [],
                pointId: new Types.ObjectId(actionData.pointId),
            }),
        ).then(() => {
            clientSocket.on('action:error', (error) => {
                expect(error.message).toBe(Constants.INVALID_DATA)
                done()
            })
            clientSocket.emit('action:server', JSON.stringify({ number: 1 }))
        })
    })

    it('with invalid data', (done) => {
        jest.spyOn(RedisUtils, 'getRedisAction').mockImplementationOnce(() => {
            throw 7
        })
        const actionData: ClientAction = {
            pointId: new Types.ObjectId().toString(),
            actionType: ActionType.PULL,
            team: {
                _id: new Types.ObjectId(),
                place: 'Pittsburgh',
                name: 'Temper',
                teamname: 'pghtemper',
                seasonStart: new Date('2022'),
                seasonEnd: new Date('2022'),
            },
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            tags: ['IB'],
        }
        Promise.resolve(
            RedisUtils.saveRedisAction(client, {
                ...actionData,
                actionNumber: 1,
                displayMessage: 'Pull',
                comments: [],
                pointId: new Types.ObjectId(actionData.pointId),
            }),
        ).then(() => {
            clientSocket.on('action:error', (error) => {
                expect(error.message).toBe(Constants.GENERIC_ERROR)
                done()
            })
            clientSocket.emit('action:server', JSON.stringify({ pointId: actionData.pointId, number: 1 }))
        })
    })
})
