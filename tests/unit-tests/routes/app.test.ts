import request from 'supertest'
import app from '../../../src/app'

describe('GET /stall-one', () => {
    it('should return a message', async () => {
        global.fetch = jest.fn().mockImplementation(() => {
            return Promise.resolve({
                json: () =>
                    Promise.resolve({
                        message: 'test message',
                    }),
            })
        })
        const response = await request(app).get('/stall-one').send().expect(200)

        expect(response.body.message).toBeDefined()
    })
})
