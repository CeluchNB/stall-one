import * as Constants from '../../../src/utils/constants'
import { setUpDatabase, tearDownDatabase, createData, gameData, resetDatabase } from '../../fixtures/setup-db'
import GamePointServices from '../../../src/services/v1/gamepoint'
import GamePoint from '../../../src/models/gamepoint'
import Game from '../../../src/models/game'
import { TeamNumber } from '../../../src/types/ultmt'

beforeAll(async () => {
    await setUpDatabase()
})

afterAll(async () => {
    await tearDownDatabase()
})

afterEach(async () => {
    await resetDatabase()
})

const services = new GamePointServices(GamePoint, Game)

describe('test create first point', () => {
    it('with valid data and no previous creation', async () => {
        const game = await Game.create(gameData)

        const point = await services.createFirstPoint(game._id.toString(), TeamNumber.ONE)
        expect(point.gameId.toString()).toBe(game._id.toString())
        expect(point.pointNumber).toBe(1)
        expect(point.teamOneScore).toBe(0)
        expect(point.teamTwoScore).toBe(0)
        expect(point.pullingTeam._id?.toString()).toBe(game.teamOne._id?.toString())
        expect(point.receivingTeam._id?.toString()).toBe(game.teamTwo._id?.toString())

        const pointRecord = await GamePoint.findOne({ gameId: game._id, pointNumber: 1 })
        expect(pointRecord?._id.toString()).toBe(point._id.toString())
    })

    it('with valid data and previous creation', async () => {
        const game = await Game.create(gameData)
        await GamePoint.create({
            gameId: game._id,
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: game.teamOne,
            receivingTeam: game.teamTwo,
        })

        const point = await services.createFirstPoint(game._id.toString(), TeamNumber.ONE)
        expect(point.gameId.toString()).toBe(game._id.toString())
        expect(point.pointNumber).toBe(1)
        expect(point.teamOneScore).toBe(0)
        expect(point.teamTwoScore).toBe(0)
        expect(point.pullingTeam._id?.toString()).toBe(game.teamOne._id?.toString())
        expect(point.receivingTeam._id?.toString()).toBe(game.teamTwo._id?.toString())

        const pointRecord = await GamePoint.find({ gameId: game._id, pointNumber: 1 })
        expect(pointRecord.length).toBe(1)
        expect(pointRecord[0]?._id.toString()).toBe(point._id.toString())
    })
})
