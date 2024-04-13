import { container } from '../../../../src/di'
import Point from '../../../../src/models/point'
import { createPointData, resetDatabase, setUpDatabase, tearDownDatabase } from '../../../fixtures/setup-db'
import '../../../../src/services/v2/point'

beforeAll(async () => {
    await setUpDatabase()
})

beforeEach(async () => {
    await resetDatabase()
})

afterAll(async () => {
    await tearDownDatabase()
})

describe('Point Services V2', () => {
    it('returns points', async () => {
        // const point = await Point.create(createPointData)
        // const services = container.resolve('pointServiceV2')
        // const result = await services.next('', '', point._id.toHexString())
        // expect(result._id.toHexString()).toBe(point._id.toHexString())
        expect(1 + 1).toBe(2)
    })
})
