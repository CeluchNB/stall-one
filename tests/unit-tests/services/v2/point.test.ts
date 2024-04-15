import { container } from '../../../../src/di'
import Point from '../../../../src/models/point'
import { createPointData, gameData, resetDatabase, setUpDatabase, tearDownDatabase } from '../../../fixtures/setup-db'
import '../../../../src/services/v2/point'
import Game from '../../../../src/models/game'
import Dependencies from '../../../../src/types/di'
import { TeamNumber } from '../../../../src/types/ultmt'
import { PointStatus } from '../../../../src/types/point'
import { client } from '../../../../src/utils/redis'

beforeAll(async () => {
    await client.connect()
    await setUpDatabase()
})

beforeEach(async () => {
    await resetDatabase()
})

afterAll(async () => {
    client.quit()
    await tearDownDatabase()
})

describe('Point Services V2', () => {
    describe('next', () => {
        let next: any
        beforeAll(() => {
            next = container.resolve('pointServiceV2').next
        })
        it('starts first point', async () => {
            const game = await Game.create(gameData)
            const result = await next(game._id.toHexString(), TeamNumber.ONE, 0, TeamNumber.ONE)

            expect(result).toMatchObject({
                gameId: game._id,
                pointNumber: 1,
                teamOneStatus: PointStatus.ACTIVE,
                teamTwoStatus: PointStatus.FUTURE,
            })
            const keys = await client.keys('*')
            expect(keys.length).toBe(4)
        })

        // it('errors when trying to create point too far in future', async () => {})

        // it('finishes and creates point', async () => {})
    })
})
