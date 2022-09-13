import * as Constants from '../../../src/utils/constants'
import * as RedisUtils from '../../../src/utils/redis'
import app, { close } from '../../../src/app'
import { resetDatabase, createData, client, setUpDatabase, tearDownDatabase } from '../../fixtures/setup-db'
import ioClient from 'socket.io-client'
import { ActionType, ClientAction } from '../../../src/types/action'
import { Types } from 'mongoose'
import Game from '../../../src/models/game'
import axios from 'axios'

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
        clientSocket.on('action:client', (action) => {
            expect(action.pointId).toBe(actionData.pointId)
            expect(action.actionNumber).toBe(1)
            expect(action.actionType).toBe(ActionType.PULL)
            expect(action.team.teamname).toBe(actionData.team.teamname)
            expect(action.playerOne.username).toBe(actionData.playerOne?.username)
            done()
        })
        clientSocket.emit('action', JSON.stringify(actionData))
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
        clientSocket.emit('action', JSON.stringify(actionData))
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
        clientSocket.emit('action', JSON.stringify(actionData))
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
            clientSocket.on('action:client', (action) => {
                expect(action.pointId.toString()).toBe(actionData.pointId.toString())
                expect(action.actionType).toBe(actionData.actionType)
                done()
            })
            clientSocket.emit('action:server', JSON.stringify({ pointId: actionData.pointId, actionNumber: 1 }))
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
            clientSocket.emit('action:server', JSON.stringify({ actionNumber: 1 }))
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
            clientSocket.emit('action:server', JSON.stringify({ pointId: actionData.pointId, actionNumber: 1 }))
        })
    })
})

describe('test action comment', () => {
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

    it('with valid data', (done) => {
        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.resolve({ data: userData, status: 200 })
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
            clientSocket.on('action:client', (action) => {
                expect(action.pointId.toString()).toBe(actionData.pointId.toString())
                expect(action.actionType).toBe(actionData.actionType)
                expect(action.comments.length).toBe(1)
                done()
            })
            clientSocket.emit(
                'action:comment',
                JSON.stringify({
                    pointId: actionData.pointId,
                    actionNumber: 1,
                    jwt: 'test.jwt.1234',
                    comment: 'That was a nice huck',
                }),
            )
        })
    })

    it('with missing data', (done) => {
        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.resolve({ data: userData, status: 200 })
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
            clientSocket.on('action:error', (action) => {
                expect(action.message).toBe(Constants.INVALID_DATA)
                done()
            })
            clientSocket.emit(
                'action:comment',
                JSON.stringify({
                    pointId: actionData.pointId,
                    actionNumber: 1,
                    comment: 'That was a nice huck',
                }),
            )
        })
    })

    it('with service error', (done) => {
        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.resolve({ data: userData, status: 200 })
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
            clientSocket.on('action:error', (action) => {
                expect(action.message).toBe(Constants.PROFANE_COMMENT)
                done()
            })
            clientSocket.emit(
                'action:comment',
                JSON.stringify({
                    pointId: actionData.pointId,
                    actionNumber: 1,
                    jwt: 'test.jwt.1234',
                    comment: 'Profane shit comment',
                }),
            )
        })
    })
})
