import * as Constants from '../../../src/utils/constants'
import * as RedisUtils from '../../../src/utils/redis'
import app, { close } from '../../../src/app'
import {
    resetDatabase,
    createData,
    setUpDatabase,
    tearDownDatabase,
    createPointData,
    client,
} from '../../fixtures/setup-db'
import ioClient from 'socket.io-client'
import { ActionType, ClientAction } from '../../../src/types/action'
import { Types } from 'mongoose'
import Game from '../../../src/models/game'
import IGame from '../../../src/types/game'
import Point from '../../../src/models/point'
import IPoint from '../../../src/types/point'
import { parseActionData } from '../../../src/utils/action'

/*
    The current socket testing setup is less than ideal. Ideally, a new
    connection would be established beforeEach test.  However, jest continually
    detects open handles when trying the open the connection beforeEach test,
    and I have not figured out a fix for this.  If this situation is resolved,
    recheck the beforeEach/beforeAll/afterEach/afterAll setup for potential improvements
    such as resetting the mongo DB between each test.
*/

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
    clientSocket.removeAllListeners()
    await client.flushAll()
})

afterAll(async () => {
    await resetDatabase()
    await close()
    await tearDownDatabase()
    clientSocket.close()
    app.close()
})

describe('test client action sent', () => {
    it('with valid data', (done) => {
        const actionData: ClientAction = {
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
            expect(action.actionNumber).toBe(1)
            expect(action.actionType).toBe(ActionType.PULL)
            expect(action.team.teamname).toBe(actionData.team.teamname)
            expect(action.playerOne.username).toBe(actionData.playerOne?.username)
            done()
        })
        clientSocket.emit('action', JSON.stringify({ action: actionData, pointId: '' }))
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
        clientSocket.emit('action', JSON.stringify({ action: actionData, pointId: '' }))
    })

    it('with non object exception', (done) => {
        jest.spyOn(RedisUtils, 'saveRedisAction').mockImplementationOnce(() => {
            throw 7
        })
        const actionData: ClientAction = {
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
        clientSocket.emit('action', JSON.stringify({ action: actionData, pointId: '' }))
    })
})

describe('test client undo action', () => {
    let game: IGame | null
    let point: IPoint
    const actionData: ClientAction = {
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
    beforeAll(async () => {
        game = await Game.findOne({})
        point = await Point.create({ ...createPointData })

        actionData.team = (game as IGame).teamOne
        await client.set(`${game?._id.toString()}:${point._id.toString()}:actions`, '1')
        await RedisUtils.saveRedisAction(client, parseActionData(actionData, 1), point._id.toString())
    })

    it('with valid data', (done) => {
        clientSocket.on('action:undo:client', (data) => {
            expect(data.pointId).toBe(point._id.toString())
            expect(data.actionNumber).toBe(1)
            done()
        })
        clientSocket.emit('action:undo', JSON.stringify({ pointId: point._id }))
    })

    it('with bad data', (done) => {
        clientSocket.on('action:error', (error) => {
            expect(error.message).toBe(Constants.INVALID_DATA)
            done()
        })
        clientSocket.emit('action:undo', JSON.stringify({}))
    })

    it('with unfound action', (done) => {
        expect(client.set(`${game?._id.toString()}:${point._id.toString()}:actions`, '0')).resolves.toBe('OK')
        clientSocket.on('action:error', (error) => {
            expect(error.message).toBe(Constants.INVALID_DATA)
            done()
        })
        clientSocket.emit('action:undo', JSON.stringify({ pointId: point._id }))
    })
})
