import request from 'supertest'
import app from '../../../src/app'

describe('GET /', () => {
    it('should return a message', async () => {
        const response = await request(app).get('/').send().expect(200)

        expect(response.body.message).toBeDefined()
    })
})

describe('GET /test', () => {
    it('should return a message', async () => {
        const response = await request(app).get('/test').send().expect(200)

        expect(response.body.message).toBeDefined()
    })
})
