import { container } from '../../../../src/di'
import Game from '../../../../src/models/game'
import Dependencies from '../../../../src/types/di'
import { setUpDatabase, tearDownDatabase, resetDatabase, gameData } from '../../../fixtures/setup-db'
import { client } from '../../../../src/utils/redis'
import { TeamNumber } from '../../../../src/types/ultmt'
import { GameStatus } from '../../../../src/types/game'

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

describe('Finsih Game', () => {
    describe('perform', () => {
        let finishGame: Dependencies['finishGame']
        beforeAll(() => {
            finishGame = container.resolve('finishGame')
        })

        it('updates team one', async () => {
            const game = await Game.create({ ...gameData, teamTwoStatus: GameStatus.ACTIVE })
            const result = await finishGame.perform(game._id.toHexString(), TeamNumber.ONE)
            expect(result.teamOneStatus).toBe(GameStatus.COMPLETE)

            const gameRecord = await Game.findById(game._id)
            expect(gameRecord?.teamOneStatus).toBe(GameStatus.COMPLETE)
            expect(gameRecord?.teamTwoStatus).toBe(GameStatus.ACTIVE)
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
