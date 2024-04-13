import { setUpDatabase, tearDownDatabase, resetDatabase } from '../../../fixtures/setup-db'

beforeAll(async () => {
    await setUpDatabase()
})

beforeEach(async () => {
    await resetDatabase()
})

afterAll(async () => {
    await tearDownDatabase()
})

describe('Next Point Domain', () => {
    describe('Finish Point', () => {
        describe('perform', () => {
            it('sample test', () => {
                expect(1 + 1).toBe(2)
            })
        })
    })
})
