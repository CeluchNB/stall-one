import { FinishPointQueue } from '../../../src/background/v1'

const mockAdd = jest.fn()

jest.mock('bullmq', () => ({
    Queue: function () {
        return { add: mockAdd }
    },
}))

describe('calls add finish point job', () => {
    it('handles call', async () => {
        const queue = FinishPointQueue()
        queue.initializeQueue()
        queue.addFinishPointJob({ gameId: '', pointId: '', team: 'one' })
        expect(mockAdd).toBeCalled()
    })
})
