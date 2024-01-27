import * as Constants from '../../../src/utils/constants'
import * as RedisUtils from '../../../src/utils/redis'
import { close, setupApp } from '../../../src/app'
import { resetDatabase, createData, client, setUpDatabase, tearDownDatabase } from '../../fixtures/setup-db'
import ioClient from 'socket.io-client'
import { ActionType, ClientAction } from '../../../src/types/action'
import { Types } from 'mongoose'
import Game from '../../../src/models/game'
import axios from 'axios'
import { Server } from 'http'

let clientSocket: ReturnType<typeof ioClient>
let gameId: string
let httpServer: Server
const pointId = 'pointid'

beforeAll((done) => {
    setupApp().then((app) => {
        httpServer = app
        app.listen(process.env.PORT, async () => {
            const game = await Game.create(createData)
            gameId = game._id.toString()
            clientSocket = ioClient(`http://localhost:${process.env.PORT}/live`)
            clientSocket.on('connect', () => {
                clientSocket.emit('join:point', gameId, pointId)
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
    httpServer.close()
})

describe('test client action error case', () => {
    it('should throw error with bad jwt', (done) => {
        const actionData: ClientAction = {
            actionType: ActionType.PULL,
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            tags: ['IB'],
        }

        clientSocket.emit('action', JSON.stringify({ action: actionData, pointId }), (response: unknown) => {
            expect(response).toMatchObject({ status: 'error', message: Constants.UNAUTHENTICATED_USER })
            done()
        })
    })
})

describe('test server action', () => {
    it('with valid data', (done) => {
        const actionData: ClientAction = {
            actionType: ActionType.PULL,
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            tags: ['IB'],
        }
        Promise.resolve(
            RedisUtils.saveRedisAction(
                client,
                {
                    ...actionData,
                    actionNumber: 1,
                    teamNumber: 'one',
                    comments: [],
                },
                pointId,
            ),
        ).then(() => {
            clientSocket.on('action:client', (action) => {
                expect(action.actionType).toBe(actionData.actionType)
                expect(action.tags[0]).toBe(actionData.tags[0])
                done()
            })
            clientSocket.emit('action:server', JSON.stringify({ pointId, gameId, actionNumber: 1, teamNumber: 'one' }))
        })
    })

    it('with invalid data', (done) => {
        const actionData: ClientAction = {
            actionType: ActionType.PULL,

            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            tags: ['IB'],
        }
        Promise.resolve(
            RedisUtils.saveRedisAction(
                client,
                {
                    ...actionData,
                    actionNumber: 1,
                    teamNumber: 'one',
                    comments: [],
                },
                pointId,
            ),
        ).then(() => {
            clientSocket.emit('action:server', JSON.stringify({ actionNumber: 1 }))
            done()
        })
    })

    it('with service error', (done) => {
        jest.spyOn(RedisUtils, 'getRedisAction').mockImplementationOnce(() => {
            throw 7
        })
        const actionData: ClientAction = {
            actionType: ActionType.PULL,
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            tags: ['IB'],
        }
        Promise.resolve(
            RedisUtils.saveRedisAction(
                client,
                {
                    ...actionData,
                    actionNumber: 1,
                    teamNumber: 'one',
                    comments: [],
                },
                pointId,
            ),
        ).then(() => {
            clientSocket.emit('action:server', JSON.stringify({ pointId, actionNumber: 1, teamNumber: 'one' }))
            done()
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
            return Promise.resolve({ data: { user: userData }, status: 200 })
        })
        const actionData: ClientAction = {
            actionType: ActionType.PULL,
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            tags: ['IB'],
        }
        Promise.resolve(
            RedisUtils.saveRedisAction(
                client,
                {
                    ...actionData,
                    actionNumber: 1,
                    teamNumber: 'one',
                    comments: [],
                },
                pointId,
            ),
        ).then(() => {
            clientSocket.on('action:client', (action) => {
                expect(action.actionType).toBe(actionData.actionType)
                expect(action.comments.length).toBe(1)
                done()
            })
            clientSocket.emit(
                'action:comment',
                JSON.stringify({
                    gameId,
                    pointId: pointId,
                    actionNumber: 1,
                    teamNumber: 'one',
                    jwt: 'test.jwt.1234',
                    comment: 'That was a nice huck',
                }),
                (response: unknown) => {
                    expect(response).toMatchObject({ status: 'good' })
                },
            )
        })
    })

    it('with missing data', (done) => {
        const actionData: ClientAction = {
            actionType: ActionType.PULL,
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            tags: ['IB'],
        }
        Promise.resolve(
            RedisUtils.saveRedisAction(
                client,
                {
                    ...actionData,
                    actionNumber: 1,
                    teamNumber: 'one',
                    comments: [],
                },
                pointId,
            ),
        ).then(() => {
            clientSocket.emit(
                'action:comment',
                JSON.stringify({
                    pointId,
                    actionNumber: 1,
                    comment: 'That was a nice huck',
                }),
                (response: unknown) => {
                    expect(response).toMatchObject({ status: 'error', message: Constants.INVALID_DATA })
                    done()
                },
            )
        })
    })

    it('with service error', (done) => {
        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.resolve({ data: { user: userData }, status: 200 })
        })
        const actionData: ClientAction = {
            actionType: ActionType.PULL,
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            tags: ['IB'],
        }
        Promise.resolve(
            RedisUtils.saveRedisAction(
                client,
                {
                    ...actionData,
                    actionNumber: 1,
                    teamNumber: 'one',
                    comments: [],
                },
                pointId,
            ),
        ).then(() => {
            clientSocket.emit(
                'action:comment',
                JSON.stringify({
                    pointId,
                    actionNumber: 1,
                    teamNumber: 'one',
                    jwt: 'test.jwt.1234',
                    comment: 'Profane shit comment',
                }),
                (response: unknown) => {
                    expect(response).toMatchObject({ status: 'error', message: Constants.PROFANE_COMMENT })
                    done()
                },
            )
        })
    })
})

describe('test delete live comment', () => {
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
            return Promise.resolve({ data: { user: userData }, status: 200 })
        })
        const actionData: ClientAction = {
            actionType: ActionType.PULL,
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            tags: ['IB'],
        }
        Promise.resolve(
            RedisUtils.saveRedisAction(
                client,
                {
                    ...actionData,
                    actionNumber: 1,
                    teamNumber: 'one',
                    comments: [],
                },
                pointId,
            ),
        )
            .then(() => {
                return RedisUtils.saveRedisComment(
                    client,
                    pointId,
                    1,
                    {
                        comment: 'Good huck',
                        user: {
                            _id: userData._id,
                            firstName: userData.firstName,
                            lastName: userData.lastName,
                            username: userData.username,
                        },
                    },
                    'one',
                )
            })
            .then(() => {
                clientSocket.on('action:client', (action) => {
                    expect(action.actionType).toBe(actionData.actionType)
                    expect(action.comments.length).toBe(0)
                    done()
                })
                clientSocket.emit(
                    'action:comment:delete',
                    JSON.stringify({
                        gameId,
                        pointId,
                        actionNumber: 1,
                        commentNumber: 1,
                        teamNumber: 'one',
                        jwt: 'test.jwt.1234',
                    }),
                )
            })
    })

    it('with wrong user', (done) => {
        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.resolve({ data: { user: userData }, status: 200 })
        })
        const actionData: ClientAction = {
            actionType: ActionType.PULL,
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            tags: ['IB'],
        }
        Promise.resolve(
            RedisUtils.saveRedisAction(
                client,
                {
                    ...actionData,
                    actionNumber: 1,
                    teamNumber: 'one',
                    comments: [],
                },
                pointId,
            ),
        )
            .then(() => {
                return RedisUtils.saveRedisComment(
                    client,
                    pointId,
                    1,
                    {
                        comment: 'Good huck',
                        user: {
                            _id: new Types.ObjectId(),
                            firstName: 'Test First',
                            lastName: 'Test Last',
                            username: 'testuser',
                        },
                    },
                    'one',
                )
            })
            .then(() => {
                clientSocket.emit(
                    'action:comment:delete',
                    JSON.stringify({
                        gameId,
                        pointId,
                        actionNumber: 1,
                        commentNumber: 1,
                        teamNumber: 'one',
                        jwt: 'test.jwt.1234',
                    }),
                    (response: unknown) => {
                        expect(response).toMatchObject({ status: 'error', message: Constants.UNAUTHENTICATED_USER })
                        done()
                    },
                )
            })
    })

    it('with missing data', (done) => {
        const actionData: ClientAction = {
            actionType: ActionType.PULL,
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            tags: ['IB'],
        }
        Promise.resolve(
            RedisUtils.saveRedisAction(
                client,
                {
                    ...actionData,
                    actionNumber: 1,
                    teamNumber: 'one',
                    comments: [],
                },
                pointId,
            ),
        )
            .then(() => {
                return RedisUtils.saveRedisComment(
                    client,
                    pointId,
                    1,
                    {
                        comment: 'Good huck',
                        user: {
                            _id: new Types.ObjectId(),
                            firstName: 'Test First',
                            lastName: 'Test Last',
                            username: 'testuser',
                        },
                    },
                    'one',
                )
            })
            .then(() => {
                clientSocket.emit(
                    'action:comment:delete',
                    JSON.stringify({
                        pointId,
                        actionNumber: 1,
                        commentNumber: 1,
                    }),
                    (response: unknown) => {
                        expect(response).toMatchObject({ status: 'error', message: Constants.INVALID_DATA })
                        done()
                    },
                )
            })
    })
})

describe('test action undo server', () => {
    it('with data', (done) => {
        clientSocket.on('action:undo:client', (data) => {
            expect(data.pointId).toBe(pointId)
            expect(data.actionNumber).toBe(2)
            done()
        })
        clientSocket.emit('action:undo:server', JSON.stringify({ gameId, pointId, actionNumber: 2 }))
    })

    it('with bad data', (done) => {
        clientSocket.emit('action:undo:server', '{ asdf54: ')
        done()
    })
})

describe('test next point server', () => {
    it('should be handle valid data', (done) => {
        clientSocket.on('point:next:client', (data) => {
            expect(data).toBeUndefined()
            done()
        })
        clientSocket.emit('point:next:server', JSON.stringify({ gameId, pointId }))
    })

    it('should handle invalid data', (done) => {
        clientSocket.emit('point:next:server')
        done()
    })
})
