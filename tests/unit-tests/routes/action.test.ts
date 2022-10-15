import * as Constants from '../../../src/utils/constants'
import app, { close } from '../../../src/app'
import request from 'supertest'
import axios from 'axios'
import Action from '../../../src/models/action'
import { resetDatabase } from '../../fixtures/setup-db'
import { Types } from 'mongoose'

afterAll(async () => {
    await close()
})

afterEach(async () => {
    await resetDatabase()
})

describe('test /PUT action', () => {
    it('with valid data', async () => {
        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.resolve({ data: {}, status: 200 })
        })
        const id = new Types.ObjectId()
        const player2 = {
            _id: id,
            firstName: 'First2',
            lastName: 'Last2',
            username: 'firstlast2',
        }
        const initAction = await Action.create({
            actionNumber: 1,
            actionType: 'Pull',
            team: {
                _id: new Types.ObjectId(),
                place: 'Place1',
                name: 'Name1',
                teamname: 'placename',
            },
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'First1',
                lastName: 'Last1',
                username: 'firstlast1',
            },
            playerTwo: player2,
        })

        const response = await request(app)
            .put(`/api/v1/action/${initAction._id.toString()}`)
            .set('Authorization', 'Bearer token')
            .send({
                players: {
                    playerOne: player2,
                },
            })
            .expect(200)

        const { action } = response.body
        expect(action.actionNumber).toBe(initAction.actionNumber)
        expect(action.actionType).toBe(initAction.actionType)
        expect(action.playerTwo).toBeUndefined()
        expect(action.playerOne._id.toString()).toBe(id.toString())
        expect(action.playerOne.firstName).toBe(player2.firstName)
        expect(action.playerOne.lastName).toBe(player2.lastName)
        expect(action.playerOne.username).toBe(player2.username)
    })

    it('with service error', async () => {
        const response = await request(app)
            .put(`/api/v1/action/${new Types.ObjectId().toString()}`)
            .set('Authorization', 'Bearer token')
            .send({ players: {} })
            .expect(404)
        expect(response.body.message).toBe(Constants.UNABLE_TO_FIND_ACTION)
    })
})
