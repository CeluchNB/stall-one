import request from 'supertest'
import { close, setupApp } from '../../../src/app'
import axios from 'axios'
import { Server } from 'http'

let app: Server
beforeAll(async () => {
    app = await setupApp()
})

afterAll(async () => {
    await close()
})

describe('GET /stall-one', () => {
    it('should return a message', async () => {
        jest.spyOn(axios, 'get').mockImplementation(() => {
            return Promise.resolve({ data: { message: 'test message' } })
        })
        const response = await request(app).get('/stall-one').send().expect(200)

        expect(response.body.message).toBeDefined()
    })
})
