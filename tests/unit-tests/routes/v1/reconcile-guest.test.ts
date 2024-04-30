import * as Constants from '../../../../src/utils/constants'
import * as ReconcileGuestMethods from '../../../../src/services/v1/reconcile-guest'
import { close, setupApp } from '../../../../src/app'
import request from 'supertest'
import Game from '../../../../src/models/game'
import { createData, resetDatabase } from '../../../fixtures/setup-db'
import { Server } from 'http'
import { Types } from 'mongoose'

let app: Server
beforeAll(async () => {
    app = await setupApp()
})

afterAll(async () => {
    await close()
})

afterEach(async () => {
    await resetDatabase()
})

const guestId = new Types.ObjectId()
const user1 = {
    _id: new Types.ObjectId(),
    firstName: 'Noah',
    lastName: 'Celuch',
    username: 'noah',
}
const guest = {
    _id: guestId,
    firstName: 'Guestfirst',
    lastName: 'Guestlast',
    username: 'guest',
}
const user2 = {
    _id: new Types.ObjectId(),
    firstName: 'Noah',
    lastName: 'Celuch',
    username: 'noah',
}
const realUser = {
    _id: new Types.ObjectId(),
    firstName: 'Realfirst',
    lastName: 'Reallast',
    username: 'real',
}
const team = {
    _id: new Types.ObjectId(),
    place: 'Team',
    name: 'Team',
    teamname: 'team',
    seasonStart: new Date(),
    seasonEnd: new Date(),
}

describe('PUT /reconcile-guest', () => {
    it('handles success', async () => {
        const game = await Game.create({
            ...createData,
            teamOne: team,
            teamOnePlayers: [user1, guest, user2],
            points: [new Types.ObjectId(), new Types.ObjectId()],
        })

        await request(app)
            .put('/api/v1/games/reconcile-guest')
            .send({
                teams: [team._id],
                guestId: guest._id,
                user: realUser,
            })
            .expect(200)

        const gameResult = await Game.findById(game._id)
        expect(gameResult?.teamOnePlayers.length).toBe(3)
        expect(gameResult?.teamOnePlayers).toEqual(expect.arrayContaining([expect.objectContaining(realUser)]))
    })

    it('handles failure', async () => {
        jest.spyOn(ReconcileGuestMethods, 'reconcileGames').mockImplementation(() => Promise.reject('stuff'))

        const response = await request(app)
            .put('/api/v1/games/reconcile-guest')
            .send({
                teams: [team._id],
                guestId: guest._id,
                user: realUser,
            })
            .expect(500)
        expect(response.body.message).toBe(Constants.GENERIC_ERROR)
    })
})
