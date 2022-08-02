import request from 'supertest'
import app from '../../../src/app'

describe('GET /stall-one', () => {
    it('should return a message', async () => {
        const response = await request(app).get('/stall-one').send().expect(200)

        expect(response.body.message).toBeDefined()
    })
})

describe('GET /test', () => {
    it('should return a message', async () => {
        const response = await request(app).get('/stall-one/test').send().expect(200)

        expect(response.body.message).toBeDefined()
    })
})
