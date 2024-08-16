import { container } from '../../../../src/di'
import Game from '../../../../src/models/game'
import Dependencies from '../../../../src/types/di'
import Point from '../../../../src/models/point'
import { setUpDatabase, tearDownDatabase, resetDatabase, gameData, createPointData } from '../../../fixtures/setup-db'
import { client } from '../../../../src/utils/redis'
import { TeamNumber } from '../../../../src/types/ultmt'
import { GameStatus } from '../../../../src/types/game'
import { PointStatus } from '../../../../src/types/point'

beforeAll(async () => {
    client.connect()
    await setUpDatabase()
})

beforeEach(async () => {
    await resetDatabase()
})

afterAll(async () => {
    await tearDownDatabase()
    client.quit()
})

describe('Finish Game', () => {
    describe('perform', () => {
        let finishGame: Dependencies['finishGame']
        beforeAll(() => {
            finishGame = container.resolve('finishGame')
        })

        it('updates team one', async () => {
            const game = await Game.create({ ...gameData, teamTwoStatus: GameStatus.ACTIVE })
            await Point.create({
                ...createPointData,
                gameId: game._id,
                teamOneStatus: PointStatus.FUTURE,
                teamTwoStatus: PointStatus.FUTURE,
            })
            const result = await finishGame.perform(game._id.toHexString(), TeamNumber.ONE)
            expect(result.teamOneStatus).toBe(GameStatus.COMPLETE)

            const gameRecord = await Game.findById(game._id)
            expect(gameRecord?.teamOneStatus).toBe(GameStatus.COMPLETE)
            expect(gameRecord?.teamTwoStatus).toBe(GameStatus.ACTIVE)

            const allPoints = await Point.find({})
            expect(allPoints.length).toBe(0)
        })

        it('updates team two', async () => {
            const game = await Game.create(gameData)
            const result = await finishGame.perform(game._id.toHexString(), TeamNumber.TWO)
            expect(result.teamTwoStatus).toBe(GameStatus.COMPLETE)

            const gameRecord = await Game.findById(game._id)
            expect(gameRecord?.teamOneStatus).toBe(GameStatus.ACTIVE)
            expect(gameRecord?.teamTwoStatus).toBe(GameStatus.COMPLETE)
        })
    })
})
