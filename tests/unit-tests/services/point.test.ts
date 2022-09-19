import * as Constants from '../../../src/utils/constants'
import {
    setUpDatabase,
    tearDownDatabase,
    gameData,
    resetDatabase,
    client,
    createData,
    createPointData,
} from '../../fixtures/setup-db'
import PointServices from '../../../src/services/v1/point'
import Point from '../../../src/models/point'
import Game from '../../../src/models/game'
import { Player, TeamNumber } from '../../../src/types/ultmt'
import { ApiError } from '../../../src/types/errors'
import { Types } from 'mongoose'
import Action from '../../../src/models/action'
import { saveRedisAction } from '../../../src/utils/redis'
import IAction, { ActionType } from '../../../src/types/action'

beforeAll(async () => {
    await setUpDatabase()
})

afterAll(async () => {
    await tearDownDatabase()
})

afterEach(async () => {
    await resetDatabase()
})

const services = new PointServices(Point, Game, Action, client)

describe('test create point', () => {
    it('with valid first point data and no previous creation', async () => {
        const game = await Game.create(gameData)

        const point = await services.createPoint(game._id.toString(), TeamNumber.ONE, 1)
        expect(point.pointNumber).toBe(1)
        expect(point.teamOneScore).toBe(0)
        expect(point.teamTwoScore).toBe(0)
        expect(point.pullingTeam._id?.toString()).toBe(game.teamOne._id?.toString())
        expect(point.receivingTeam._id?.toString()).toBe(game.teamTwo._id?.toString())

        const pointRecord = await Point.findOne({ pointNumber: 1 })
        expect(pointRecord?._id.toString()).toBe(point._id.toString())

        const gameRecord = await Game.findById(game._id)
        expect(gameRecord?.points.length).toBe(1)
        expect(gameRecord?.points[0].toString()).toBe(point._id.toString())
    })

    it('with valid first point data and team two', async () => {
        const game = await Game.create(gameData)

        const point = await services.createPoint(game._id.toString(), TeamNumber.TWO, 1)
        expect(point.pointNumber).toBe(1)
        expect(point.teamOneScore).toBe(0)
        expect(point.teamTwoScore).toBe(0)
        expect(point.pullingTeam._id?.toString()).toBe(game.teamTwo._id?.toString())
        expect(point.receivingTeam._id?.toString()).toBe(game.teamOne._id?.toString())

        const pointRecord = await Point.findOne({ pointNumber: 1 })
        expect(pointRecord?._id.toString()).toBe(point._id.toString())

        const gameRecord = await Game.findById(game._id)
        expect(gameRecord?.points.length).toBe(1)
        expect(gameRecord?.points[0].toString()).toBe(point._id.toString())
    })

    it('with valid first point data and previous creation', async () => {
        const game = await Game.create(gameData)
        const point1 = await Point.create({
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: game.teamOne,
            receivingTeam: game.teamTwo,
        })
        game.points.push(point1._id)
        await game.save()

        const point = await services.createPoint(game._id.toString(), TeamNumber.ONE, 1)
        expect(point.pointNumber).toBe(1)
        expect(point.teamOneScore).toBe(0)
        expect(point.teamTwoScore).toBe(0)
        expect(point.pullingTeam._id?.toString()).toBe(game.teamOne._id?.toString())
        expect(point.receivingTeam._id?.toString()).toBe(game.teamTwo._id?.toString())

        const pointRecord = await Point.find({ pointNumber: 1 })
        expect(pointRecord.length).toBe(1)
        expect(pointRecord[0]?._id.toString()).toBe(point._id.toString())

        const gameRecord = await Game.findById(game._id)
        expect(gameRecord?.points.length).toBe(1)
        expect(gameRecord?.points[0].toString()).toBe(point._id.toString())
    })

    it('with valid third point data', async () => {
        const game = await Game.create(gameData)
        const point1 = await Point.create({
            pointNumber: 1,
            pullingTeam: game.teamOne,
            receivingTeam: game.teamTwo,
            teamOneScore: 0,
            teamTwoScore: 0,
        })
        const point2 = await Point.create({
            pointNumber: 2,
            pullingTeam: game.teamOne,
            receivingTeam: game.teamTwo,
            teamOneScore: 1,
            teamTwoScore: 0,
        })
        game.points = [point1._id, point2._id]
        await game.save()

        const point = await services.createPoint(game._id.toString(), TeamNumber.ONE, 3)
        expect(point.pointNumber).toBe(3)
        expect(point.teamOneScore).toBe(0)
        expect(point.teamTwoScore).toBe(0)
        expect(point.pullingTeam._id?.toString()).toBe(game.teamOne._id?.toString())
        expect(point.receivingTeam._id?.toString()).toBe(game.teamTwo._id?.toString())

        const pointRecord = await Point.findOne({ pointNumber: 3 })
        expect(pointRecord?._id.toString()).toBe(point._id.toString())

        const gameRecord = await Game.findById(game._id)
        expect(gameRecord?.points.length).toBe(3)
        expect(gameRecord?.points[2].toString()).toBe(point._id.toString())
    })

    it('with unfound game', async () => {
        await expect(services.createPoint(new Types.ObjectId().toString(), TeamNumber.ONE, 1)).rejects.toThrowError(
            new ApiError(Constants.UNABLE_TO_FIND_GAME, 404),
        )
    })

    it('with team two conflicting possession', async () => {
        const game = await Game.create(gameData)
        await Point.create({
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: game.teamOne,
            receivingTeam: game.teamTwo,
        })

        await expect(services.createPoint(game._id.toString(), TeamNumber.TWO, 1)).rejects.toThrowError(
            new ApiError(Constants.CONFLICTING_POSSESSION, 400),
        )
    })

    it('with team one conflicting posession', async () => {
        const game = await Game.create(gameData)
        await Point.create({
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: game.teamTwo,
            receivingTeam: game.teamOne,
        })

        await expect(services.createPoint(game._id.toString(), TeamNumber.ONE, 1)).rejects.toThrowError(
            new ApiError(Constants.CONFLICTING_POSSESSION, 400),
        )
    })

    it('with null team one id', async () => {
        const game = await Game.create({ ...gameData, teamOne: { name: 'Test Team One' } })
        await Point.create({
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: gameData.teamOne,
            receivingTeam: game.teamTwo,
        })

        await expect(services.createPoint(game._id.toString(), TeamNumber.ONE, 1)).rejects.toThrowError(
            new ApiError(Constants.CONFLICTING_POSSESSION, 400),
        )
    })

    it('with number under 1', async () => {
        const game = await Game.create({ ...gameData, teamOne: { name: 'Test Team One' } })

        await expect(services.createPoint(game._id.toString(), TeamNumber.ONE, 0)).rejects.toThrowError(
            new ApiError(Constants.INVALID_DATA, 400),
        )
    })

    it('with no previous point', async () => {
        const game = await Game.create({ ...gameData, teamOne: { name: 'Test Team One' } })
        await Point.create({
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: gameData.teamOne,
            receivingTeam: game.teamTwo,
        })

        await expect(services.createPoint(game._id.toString(), TeamNumber.ONE, 3)).rejects.toThrowError(
            new ApiError(Constants.INVALID_DATA, 400),
        )
    })
})

describe('test add players to point', () => {
    it('with valid data for team one', async () => {
        const game = await Game.create(gameData)
        const initialPoint = await Point.create({
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

        const point = await services.setPlayers(
            game._id.toString(),
            initialPoint._id.toString(),
            TeamNumber.ONE,
            players,
        )
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

        const point = await services.setPlayers(
            game._id.toString(),
            initialPoint._id.toString(),
            TeamNumber.TWO,
            players,
        )
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
        await expect(
            services.setPlayers(new Types.ObjectId().toString(), new Types.ObjectId().toString(), TeamNumber.ONE, []),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FIND_POINT, 404))
    })

    it('with unfound game', async () => {
        const point = await Point.create({
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: gameData.teamOne,
            receivingTeam: gameData.teamTwo,
        })
        await expect(
            services.setPlayers(new Types.ObjectId().toString(), point._id.toString(), TeamNumber.ONE, []),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FIND_GAME, 404))
    })

    it('with wrong number of players', async () => {
        const game = await Game.create(gameData)
        const initialPoint = await Point.create({
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
            services.setPlayers(game._id.toString(), initialPoint._id.toString(), TeamNumber.ONE, players),
        ).rejects.toThrowError(new ApiError(Constants.WRONG_NUMBER_OF_PLAYERS, 400))
    })
})

describe('test finish point', () => {
    it('with valid team one "we" score', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()

        const action1: IAction = {
            actionNumber: 1,
            actionType: ActionType.CATCH,
            team: game.teamOne,
            displayMessage: 'Throw from Noah to Connor',
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            playerTwo: {
                _id: new Types.ObjectId(),
                firstName: 'Connor',
                lastName: 'Tipping',
                username: 'connor',
            },
            comments: [],
            tags: ['Huck'],
        }

        const action2: IAction = {
            actionNumber: 2,
            actionType: ActionType.WE_SCORE,
            team: game.teamOne,
            displayMessage: 'Score from Noah to Connor',
            playerTwo: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Connor',
                lastName: 'Tipping',
                username: 'connor',
            },
            comments: [],
            tags: ['Break'],
        }

        await client.set(`${game._id.toString()}:${point._id.toString()}:actions`, 2)
        await saveRedisAction(client, action1, point._id.toString())
        await saveRedisAction(client, action2, point._id.toString())

        // check point actions and score update
        const result = await services.finishPoint(game._id.toString(), point._id.toString())
        expect(result.actions.length).toBe(2)
        expect(result.teamOneScore).toBe(1)
        expect(result.teamTwoScore).toBe(0)
        expect(result.scoringTeam?.name).toBe(game.teamOne.name)

        // check team score update
        const gameRecord = await Game.findById(game._id)
        expect(gameRecord?.teamOneScore).toBe(1)
        expect(gameRecord?.teamTwoScore).toBe(0)

        // check action creation
        const actions = await Action.find({ _id: { $in: result.actions } })
        expect(actions.length).toBe(2)
        expect(actions[0].actionNumber).toBe(action1.actionNumber)
        expect(actions[0].actionType).toBe(action1.actionType)
        expect(actions[0].tags[0]).toBe(action1.tags[0])
        expect(actions[1].actionNumber).toBe(action2.actionNumber)
        expect(actions[1].actionType).toBe(action2.actionType)
        expect(actions[1].tags[0]).toBe(action2.tags[0])

        // check redis action deletion
        const keys = await client.keys('*')
        expect(keys.length).toBe(1)
    })

    it('with valid team one "they" score', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()

        const action1: IAction = {
            actionNumber: 1,
            actionType: ActionType.PULL,
            team: game.teamOne,
            displayMessage: 'Noah pulls',
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            comments: [],
            tags: ['Huck'],
        }

        const action2: IAction = {
            actionNumber: 2,
            actionType: ActionType.THEY_SCORE,
            team: game.teamOne,
            displayMessage: 'Score from Noah to Connor',
            comments: [],
            tags: ['Break'],
        }

        await client.set(`${game._id.toString()}:${point._id.toString()}:actions`, 2)
        await saveRedisAction(client, action1, point._id.toString())
        await saveRedisAction(client, action2, point._id.toString())

        // check point actions and score update
        const result = await services.finishPoint(game._id.toString(), point._id.toString())
        expect(result.actions.length).toBe(2)
        expect(result.teamOneScore).toBe(0)
        expect(result.teamTwoScore).toBe(1)
        expect(result.scoringTeam?.name).toBe(game.teamTwo.name)

        // check team score update
        const gameRecord = await Game.findById(game._id)
        expect(gameRecord?.teamOneScore).toBe(0)
        expect(gameRecord?.teamTwoScore).toBe(1)

        // check action creation
        const actions = await Action.find({ _id: { $in: result.actions } })
        expect(actions.length).toBe(2)
        expect(actions[0].actionNumber).toBe(action1.actionNumber)
        expect(actions[0].actionType).toBe(action1.actionType)
        expect(actions[0].tags[0]).toBe(action1.tags[0])
        expect(actions[1].actionNumber).toBe(action2.actionNumber)
        expect(actions[1].actionType).toBe(action2.actionType)
        expect(actions[1].tags[0]).toBe(action2.tags[0])

        // check redis action deletion
        const keys = await client.keys('*')
        expect(keys.length).toBe(1)
    })

    it('with valid team two "they" score', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()

        const action1: IAction = {
            actionNumber: 1,
            actionType: ActionType.PULL,
            team: game.teamTwo,
            displayMessage: 'Noah pulls',
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            comments: [],
            tags: ['Huck'],
        }

        const action2: IAction = {
            actionNumber: 2,
            actionType: ActionType.THEY_SCORE,
            team: game.teamTwo,
            displayMessage: 'Score from Noah to Connor',
            comments: [],
            tags: ['Break'],
        }

        await client.set(`${game._id.toString()}:${point._id.toString()}:actions`, 2)
        await saveRedisAction(client, action1, point._id.toString())
        await saveRedisAction(client, action2, point._id.toString())

        // check point actions and score update
        const result = await services.finishPoint(game._id.toString(), point._id.toString())
        expect(result.actions.length).toBe(2)
        expect(result.teamOneScore).toBe(1)
        expect(result.teamTwoScore).toBe(0)
        expect(result.scoringTeam?.name).toBe(game.teamOne.name)

        // check team score update
        const gameRecord = await Game.findById(game._id)
        expect(gameRecord?.teamOneScore).toBe(1)
        expect(gameRecord?.teamTwoScore).toBe(0)

        // check action creation
        const actions = await Action.find({ _id: { $in: result.actions } })
        expect(actions.length).toBe(2)
        expect(actions[0].actionNumber).toBe(action1.actionNumber)
        expect(actions[0].actionType).toBe(action1.actionType)
        expect(actions[0].tags[0]).toBe(action1.tags[0])
        expect(actions[1].actionNumber).toBe(action2.actionNumber)
        expect(actions[1].actionType).toBe(action2.actionType)
        expect(actions[1].tags[0]).toBe(action2.tags[0])

        // check redis action deletion
        const keys = await client.keys('*')
        expect(keys.length).toBe(1)
    })

    it('with unfound point', async () => {
        await expect(
            services.finishPoint(new Types.ObjectId().toString(), new Types.ObjectId().toString()),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FIND_POINT, 404))
    })

    it('with unfound game', async () => {
        const point = await Point.create(createPointData)
        await expect(services.finishPoint(new Types.ObjectId().toString(), point._id.toString())).rejects.toThrowError(
            new ApiError(Constants.UNABLE_TO_FIND_GAME, 404),
        )
    })

    it('with wrong game/point id combination', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        await expect(services.finishPoint(game._id.toString(), point._id.toString())).rejects.toThrowError(
            new ApiError(Constants.INVALID_DATA, 400),
        )
    })

    it('with unfound action and no score', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()

        const action1: IAction = {
            actionNumber: 1,
            actionType: ActionType.CATCH,
            team: game.teamOne,
            displayMessage: 'Throw from Noah to Connor',
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            playerTwo: {
                _id: new Types.ObjectId(),
                firstName: 'Connor',
                lastName: 'Tipping',
                username: 'connor',
            },
            comments: [],
            tags: ['Huck'],
        }

        const action2: IAction = {
            actionNumber: 3,
            actionType: ActionType.CATCH,
            team: game.teamOne,
            displayMessage: 'Throw from Noah to Connor',
            playerTwo: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Connor',
                lastName: 'Tipping',
                username: 'connor',
            },
            comments: [],
            tags: ['Break'],
        }

        await client.set(`${game._id.toString()}:${point._id.toString()}:actions`, 3)
        await saveRedisAction(client, action1, point._id.toString())
        await saveRedisAction(client, action2, point._id.toString())

        await expect(services.finishPoint(game._id.toString(), point._id.toString())).rejects.toThrowError(
            new ApiError(Constants.SCORE_REQUIRED, 400),
        )
    })

    it('with previously finished point', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()

        const action1: IAction = {
            actionNumber: 1,
            actionType: ActionType.CATCH,
            team: game.teamOne,
            displayMessage: 'Throw from Noah to Connor',
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            playerTwo: {
                _id: new Types.ObjectId(),
                firstName: 'Connor',
                lastName: 'Tipping',
                username: 'connor',
            },
            comments: [],
            tags: ['Huck'],
        }

        const action2: IAction = {
            actionNumber: 2,
            actionType: ActionType.WE_SCORE,
            team: game.teamOne,
            displayMessage: 'Score from Noah to Connor',
            playerTwo: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Connor',
                lastName: 'Tipping',
                username: 'connor',
            },
            comments: [],
            tags: ['Break'],
        }

        await client.set(`${game._id.toString()}:${point._id.toString()}:actions`, 2)
        await saveRedisAction(client, action1, point._id.toString())
        await saveRedisAction(client, action2, point._id.toString())
        await services.finishPoint(game._id.toString(), point._id.toString())
        const result = await services.finishPoint(game._id.toString(), point._id.toString())
        expect(result.actions.length).toBe(2)
        expect(result.teamOneScore).toBe(1)
        expect(result.teamTwoScore).toBe(0)
    })
})
