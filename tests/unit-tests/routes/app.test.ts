import request from 'supertest'
import app, { close } from '../../../src/app'
import axios from 'axios'

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
