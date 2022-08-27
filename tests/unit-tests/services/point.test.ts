import * as Constants from '../../../src/utils/constants'
import { setUpDatabase, tearDownDatabase, gameData, resetDatabase } from '../../fixtures/setup-db'
import PointServices from '../../../src/services/v1/point'
import Point from '../../../src/models/point'
import Game from '../../../src/models/game'
import { Player, TeamNumber } from '../../../src/types/ultmt'
import { ApiError } from '../../../src/types/errors'
import { Types } from 'mongoose'

beforeAll(async () => {
    await setUpDatabase()
})

afterAll(async () => {
    await tearDownDatabase()
})

afterEach(async () => {
    await resetDatabase()
})

const services = new PointServices(Point, Game)

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

        const pointRecord = await Point.findOne({ gameId: game._id, pointNumber: 1 })
        expect(pointRecord?._id.toString()).toBe(point._id.toString())
    })

    it('with valid data and team two', async () => {
        const game = await Game.create(gameData)

        const point = await services.createFirstPoint(game._id.toString(), TeamNumber.TWO)
        expect(point.gameId.toString()).toBe(game._id.toString())
        expect(point.pointNumber).toBe(1)
        expect(point.teamOneScore).toBe(0)
        expect(point.teamTwoScore).toBe(0)
        expect(point.pullingTeam._id?.toString()).toBe(game.teamTwo._id?.toString())
        expect(point.receivingTeam._id?.toString()).toBe(game.teamOne._id?.toString())

        const pointRecord = await Point.findOne({ gameId: game._id, pointNumber: 1 })
        expect(pointRecord?._id.toString()).toBe(point._id.toString())
    })

    it('with valid data and previous creation', async () => {
        const game = await Game.create(gameData)
        await Point.create({
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

        const pointRecord = await Point.find({ gameId: game._id, pointNumber: 1 })
        expect(pointRecord.length).toBe(1)
        expect(pointRecord[0]?._id.toString()).toBe(point._id.toString())
    })

    it('with unfound game', async () => {
        await expect(services.createFirstPoint(new Types.ObjectId().toString(), TeamNumber.ONE)).rejects.toThrowError(
            new ApiError(Constants.UNABLE_TO_FIND_GAME, 404),
        )
    })

    it('with team two conflicting possession', async () => {
        const game = await Game.create(gameData)
        await Point.create({
            gameId: game._id,
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: game.teamOne,
            receivingTeam: game.teamTwo,
        })

        await expect(services.createFirstPoint(game._id.toString(), TeamNumber.TWO)).rejects.toThrowError(
            new ApiError(Constants.CONFLICTING_POSSESSION, 400),
        )
    })

    it('with team one conflicting posession', async () => {
        const game = await Game.create(gameData)
        await Point.create({
            gameId: game._id,
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: game.teamTwo,
            receivingTeam: game.teamOne,
        })

        await expect(services.createFirstPoint(game._id.toString(), TeamNumber.ONE)).rejects.toThrowError(
            new ApiError(Constants.CONFLICTING_POSSESSION, 400),
        )
    })

    it('with null team one id', async () => {
        const game = await Game.create({ ...gameData, teamOne: { name: 'Test Team One' } })
        await Point.create({
            gameId: game._id,
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: gameData.teamOne,
            receivingTeam: game.teamTwo,
        })

        await expect(services.createFirstPoint(game._id.toString(), TeamNumber.ONE)).rejects.toThrowError(
            new ApiError(Constants.CONFLICTING_POSSESSION, 400),
        )
    })

    describe('test add players to point', () => {
        it('with valid data for team one', async () => {
            const game = await Game.create(gameData)
            const initialPoint = await Point.create({
                gameId: game._id,
                pointNumber: 1,
                teamOneScore: 0,
                teamTwoScore: 0,
                teamOnePlayers: [],
                teamTwoPlayers: [],
                pullingTeam: game.teamOne,
                receivingTeam: game.teamTwo,
            })

            const players: Player[] = []
            for (let i = 0; i < 7; i++) {
                players.push({
                    _id: new Types.ObjectId(),
                    firstName: `First ${i}`,
                    lastName: `Last ${i}`,
                    username: `First${i}last${i}`,
                })
            }

            const point = await services.setPlayers(initialPoint._id.toString(), TeamNumber.ONE, players)
            expect(point._id.toString()).toBe(initialPoint._id.toString())
            expect(point.pointNumber).toBe(1)
            expect(point.teamOnePlayers.length).toBe(7)
            expect(point.teamTwoPlayers.length).toBe(0)

            const updatedPoint = await Point.findById(initialPoint._id)
            expect(updatedPoint?.pointNumber).toBe(1)
            expect(updatedPoint?.teamOnePlayers.length).toBe(7)
            expect(updatedPoint?.teamTwoPlayers.length).toBe(0)
        })

        it('with valid data for team two', async () => {
            const game = await Game.create(gameData)
            const initialPoint = await Point.create({
                gameId: game._id,
                pointNumber: 1,
                teamOneScore: 0,
                teamTwoScore: 0,
                teamOnePlayers: [],
                teamTwoPlayers: [],
                pullingTeam: game.teamOne,
                receivingTeam: game.teamTwo,
            })

            const players: Player[] = []
            for (let i = 0; i < 7; i++) {
                players.push({
                    _id: new Types.ObjectId(),
                    firstName: `First ${i}`,
                    lastName: `Last ${i}`,
                    username: `First${i}last${i}`,
                })
            }

            const point = await services.setPlayers(initialPoint._id.toString(), TeamNumber.TWO, players)
            expect(point._id.toString()).toBe(initialPoint._id.toString())
            expect(point.pointNumber).toBe(1)
            expect(point.teamOnePlayers.length).toBe(0)
            expect(point.teamTwoPlayers.length).toBe(7)

            const updatedPoint = await Point.findById(initialPoint._id)
            expect(updatedPoint?.pointNumber).toBe(1)
            expect(updatedPoint?.teamOnePlayers.length).toBe(0)
            expect(updatedPoint?.teamTwoPlayers.length).toBe(7)
        })

        it('with unfound point', async () => {
            await expect(services.setPlayers(new Types.ObjectId().toString(), TeamNumber.ONE, [])).rejects.toThrowError(
                new ApiError(Constants.UNABLE_TO_FIND_POINT, 404),
            )
        })

        it('with unfound game', async () => {
            const point = await Point.create({
                gameId: new Types.ObjectId(),
                pointNumber: 1,
                teamOneScore: 0,
                teamTwoScore: 0,
                teamOnePlayers: [],
                teamTwoPlayers: [],
                pullingTeam: gameData.teamOne,
                receivingTeam: gameData.teamTwo,
            })
            await expect(services.setPlayers(point._id.toString(), TeamNumber.ONE, [])).rejects.toThrowError(
                new ApiError(Constants.UNABLE_TO_FIND_GAME, 404),
            )
        })

        it('with wrong number of players', async () => {
            const game = await Game.create(gameData)
            const initialPoint = await Point.create({
                gameId: game._id,
                pointNumber: 1,
                teamOneScore: 0,
                teamTwoScore: 0,
                teamOnePlayers: [],
                teamTwoPlayers: [],
                pullingTeam: game.teamOne,
                receivingTeam: game.teamTwo,
            })

            const players: Player[] = []
            for (let i = 0; i < 9; i++) {
                players.push({
                    _id: new Types.ObjectId(),
                    firstName: `First ${i}`,
                    lastName: `Last ${i}`,
                    username: `First${i}last${i}`,
                })
            }

            await expect(
                services.setPlayers(initialPoint._id.toString(), TeamNumber.ONE, players),
            ).rejects.toThrowError(new ApiError(Constants.WRONG_NUMBER_OF_PLAYERS, 400))
        })
    })
})
