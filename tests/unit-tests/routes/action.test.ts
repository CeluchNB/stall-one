import * as Constants from '../../../src/utils/constants'
import app, { close } from '../../../src/app'
import request from 'supertest'
import axios from 'axios'
import Action from '../../../src/models/action'
import { resetDatabase } from '../../fixtures/setup-db'
import { Model, Types } from 'mongoose'

afterAll(async () => {
    await close()
})

afterEach(async () => {
    await resetDatabase()
})

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

describe('test /PUT action', () => {
    it('with valid data', async () => {
        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.resolve({ data: { user: userData }, status: 200 })
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

describe('test /POST comment', () => {
    it('with valid data', async () => {
        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.resolve({ data: { user: userData }, status: 200 })
        })
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
        })

        const response = await request(app)
            .post(`/api/v1/action/${initAction._id.toString()}/comment`)
            .set('Authorization', 'Bearer token')
            .send({ comment: 'Good huck' })
            .expect(201)

        const { action } = response.body

        expect(action.comments.length).toBe(1)
        expect(action.comments[0].user.username).toBe(userData.username)
        expect(action.comments[0].comment).toBe('Good huck')
        expect(action.comments[0].commentNumber).toBe(1)
    })

    it('with service error', async () => {
        const response = await request(app)
            .post(`/api/v1/action/${new Types.ObjectId().toString()}/comment`)
            .set('Authorization', 'Bearer token')
            .send({ comment: 'Good huck' })
            .expect(404)

        expect(response.body.message).toBe(Constants.UNABLE_TO_FIND_ACTION)
    })
})

describe('test /DELETE comment', () => {
    it('with valid data', async () => {
        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.resolve({ data: { user: userData }, status: 200 })
        })
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
            comments: [
                {
                    user: {
                        _id: userData._id,
                        firstName: userData.firstName,
                        lastName: userData.lastName,
                        username: userData.username,
                    },
                    comment: 'Good huck!',
                    commentNumber: 1,
                },
            ],
        })

        const response = await request(app)
            .delete(`/api/v1/action/${initAction._id.toString()}/comment/1`)
            .set('Authorization', 'Bearer jwt')
            .send()
            .expect(200)

        const { action } = response.body
        expect(action.comments.length).toBe(0)
    })

    it('with service error', async () => {
        const response = await request(app)
            .delete(`/api/v1/action/${new Types.ObjectId()}/comment/1`)
            .set('Authorization', 'Bearer jwt')
            .send()
            .expect(404)

        expect(response.body.message).toBe(Constants.UNABLE_TO_FIND_ACTION)
    })
})

describe('test /GET actions', () => {
    beforeEach(async () => {
        const team = {
            _id: new Types.ObjectId(),
            seasonStart: new Date(),
            seasonEnd: new Date(),
            place: 'Place 1',
            name: 'Name 1',
            teamname: 'placename',
        }
        await Action.create({
            team,
            actionNumber: 1,
            actionType: 'TeamOneScore',
        })
        await Action.create({
            team,
            actionNumber: 1,
            actionType: 'Pull',
        })
        await Action.create({
            team,
            actionNumber: 2,
            actionType: 'TeamOneScore',
        })
    })

    it('with found actions', async () => {
        const [action1, action2] = await Action.find({})
        const ids = [action1._id.toString(), action2._id.toString()]

        const response = await request(app).get('/api/v1/actions').send({ ids }).expect(200)
        const { actions } = response.body
        expect(actions.length).toBe(2)
        expect(actions[0].actionNumber).toBe(1)
        expect(actions[0].actionType).toBe('TeamOneScore')

        expect(actions[1].actionNumber).toBe(1)
        expect(actions[1].actionType).toBe('Pull')
    })

    it('with unfound actions', async () => {
        const response = await request(app).get('/api/v1/actions').send({ ids: [] }).expect(200)
        const { actions } = response.body
        expect(actions.length).toBe(0)
    })

    it('with service error', async () => {
        jest.spyOn(Model, 'find').mockImplementationOnce(() => {
            throw Error()
        })

        const response = await request(app).get('/api/v1/actions').send({ ids: [] }).expect(500)
        expect(response.body.message).toBe(Constants.GENERIC_ERROR)
    })
})
