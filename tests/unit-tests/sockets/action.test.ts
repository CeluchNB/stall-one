import app, { close } from '../../../src/app'
import { resetDatabase, createData } from '../../fixtures/setup-db'
import ioClient from 'socket.io-client'
import { ActionType, ClientAction } from '../../../src/types/action'
import { Types } from 'mongoose'
import Game from '../../../src/models/game'

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

afterEach(async () => {
    await resetDatabase()
})

afterAll(async () => {
    await close()
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
})
