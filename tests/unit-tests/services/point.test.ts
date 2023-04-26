/* eslint-disable @typescript-eslint/no-non-null-assertion */
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
import { getRedisAction, saveRedisAction } from '../../../src/utils/redis'
import { ActionType, RedisAction } from '../../../src/types/action'
import { getActionBaseKey } from '../../../src/utils/utils'
import IGame from '../../../src/types/game'
import IPoint from '../../../src/types/point'

jest.mock('@google-cloud/tasks/build/src/v2')

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
        expect(point.teamOneActive).toBe(true)
        expect(point.teamTwoActive).toBe(false)

        const pointRecord = await Point.findOne({ pointNumber: 1 })
        expect(pointRecord?._id.toString()).toBe(point._id.toString())

        const gameRecord = await Game.findById(game._id)
        expect(gameRecord?.points.length).toBe(1)
        expect(gameRecord?.points[0].toString()).toBe(point._id.toString())

        const oneActionsValue = await client.get(`${game._id.toString()}:${point._id.toString()}:one:actions`)
        expect(oneActionsValue).toBe('0')
        const twoActionsValue = await client.get(`${game._id.toString()}:${point._id.toString()}:two:actions`)
        expect(twoActionsValue).toBe('0')
        const pullingTeam = await client.get(`${game._id.toString()}:${point._id.toString()}:pulling`)
        expect(pullingTeam).toBe('one')
        const receivingTeam = await client.get(`${game._id.toString()}:${point._id.toString()}:receiving`)
        expect(receivingTeam).toBe('two')
    })

    it('with valid first point data and team two', async () => {
        const game = await Game.create({ ...gameData, teamTwoActive: true })

        const point = await services.createPoint(game._id.toString(), TeamNumber.TWO, 1)
        expect(point.pointNumber).toBe(1)
        expect(point.teamOneScore).toBe(0)
        expect(point.teamTwoScore).toBe(0)
        expect(point.pullingTeam._id?.toString()).toBe(game.teamTwo._id?.toString())
        expect(point.receivingTeam._id?.toString()).toBe(game.teamOne._id?.toString())
        expect(point.teamOneActive).toBe(true)
        expect(point.teamTwoActive).toBe(true)

        const pointRecord = await Point.findOne({ pointNumber: 1 })
        expect(pointRecord?._id.toString()).toBe(point._id.toString())
        expect(pointRecord?.teamOneActive).toBe(true)
        expect(pointRecord?.teamTwoActive).toBe(true)

        const gameRecord = await Game.findById(game._id)
        expect(gameRecord?.points.length).toBe(1)
        expect(gameRecord?.points[0].toString()).toBe(point._id.toString())
        const oneActionsValue = await client.get(`${game._id.toString()}:${point._id.toString()}:one:actions`)
        expect(oneActionsValue).toBe('0')
        const twoActionsValue = await client.get(`${game._id.toString()}:${point._id.toString()}:two:actions`)
        expect(twoActionsValue).toBe('0')
        const pullingTeam = await client.get(`${game._id.toString()}:${point._id.toString()}:pulling`)
        expect(pullingTeam).toBe('two')
        const receivingTeam = await client.get(`${game._id.toString()}:${point._id.toString()}:receiving`)
        expect(receivingTeam).toBe('one')
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
            teamTwoActive: false,
        })
        game.points.push(point1._id)
        await game.save()

        const point = await services.createPoint(game._id.toString(), TeamNumber.ONE, 1)
        expect(point.pointNumber).toBe(1)
        expect(point.teamOneScore).toBe(0)
        expect(point.teamTwoScore).toBe(0)
        expect(point.pullingTeam._id?.toString()).toBe(game.teamOne._id?.toString())
        expect(point.receivingTeam._id?.toString()).toBe(game.teamTwo._id?.toString())
        expect(point.teamOneActive).toBe(true)
        expect(point.teamTwoActive).toBe(false)

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
            teamTwoScore: 1,
        })
        const point2 = await Point.create({
            pointNumber: 2,
            pullingTeam: game.teamOne,
            receivingTeam: game.teamTwo,
            teamOneScore: 1,
            teamTwoScore: 1,
        })
        game.points = [point1._id, point2._id]
        game.teamOneScore = 1
        game.teamTwoScore = 1
        await game.save()

        const point = await services.createPoint(game._id.toString(), TeamNumber.ONE, 3)
        expect(point.pointNumber).toBe(3)
        expect(point.teamOneScore).toBe(1)
        expect(point.teamTwoScore).toBe(1)
        expect(point.pullingTeam._id?.toString()).toBe(game.teamOne._id?.toString())
        expect(point.receivingTeam._id?.toString()).toBe(game.teamTwo._id?.toString())

        const pointRecord = await Point.findOne({ pointNumber: 3 })
        expect(pointRecord?._id.toString()).toBe(point._id.toString())

        const gameRecord = await Game.findById(game._id)
        expect(gameRecord?.points.length).toBe(3)
        expect(gameRecord?.points[2].toString()).toBe(point._id.toString())
        const pullingTeam = await client.get(`${game._id.toString()}:${point._id.toString()}:pulling`)
        expect(pullingTeam).toBe('one')
        const receivingTeam = await client.get(`${game._id.toString()}:${point._id.toString()}:receiving`)
        expect(receivingTeam).toBe('two')
    })

    it('with unfound game', async () => {
        await expect(services.createPoint(new Types.ObjectId().toString(), TeamNumber.ONE, 1)).rejects.toThrowError(
            new ApiError(Constants.UNABLE_TO_FIND_GAME, 404),
        )
    })

    it('with team two conflicting possession', async () => {
        const game = await Game.create(gameData)
        const point = await Point.create({
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: game.teamOne,
            receivingTeam: game.teamTwo,
        })
        game.points.push(point._id)
        await game.save()

        await expect(services.createPoint(game._id.toString(), TeamNumber.TWO, 1)).rejects.toThrowError(
            new ApiError(Constants.CONFLICTING_POSSESSION, 400),
        )
    })

    it('with team one conflicting posession', async () => {
        const game = await Game.create(gameData)
        const point = await Point.create({
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: game.teamTwo,
            receivingTeam: game.teamOne,
        })
        game.points.push(point._id)
        await game.save()

        await expect(services.createPoint(game._id.toString(), TeamNumber.ONE, 1)).rejects.toThrowError(
            new ApiError(Constants.CONFLICTING_POSSESSION, 400),
        )
    })

    it('with null team one id', async () => {
        const game = await Game.create({ ...gameData, teamOne: { name: 'Test Team One' } })
        const point = await Point.create({
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: gameData.teamOne,
            receivingTeam: game.teamTwo,
        })
        game.points.push(point._id)
        await game.save()

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

describe('test set pulling team', () => {
    it('with valid data changing the pulling team', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()

        await client.set(`${game._id.toString()}:${point._id.toString()}:pulling`, 'one')
        await client.set(`${game._id.toString()}:${point._id.toString()}:receiving`, 'two')

        const result = await services.setPullingTeam(game._id.toString(), point._id.toString(), TeamNumber.TWO)
        expect(result.pullingTeam.name).toBe(game.teamTwo.name)
        expect(result.receivingTeam._id?.toString()).toBe(game.teamOne._id?.toString())

        const pointRecord = await Point.findById(point._id)
        expect(pointRecord?.pullingTeam.name).toBe(game.teamTwo.name)
        expect(pointRecord?.receivingTeam._id?.toString()).toBe(game.teamOne._id?.toString())
        const pullingTeam = await client.get(`${game._id.toString()}:${point._id.toString()}:pulling`)
        expect(pullingTeam).toBe('two')
        const receivingTeam = await client.get(`${game._id.toString()}:${point._id.toString()}:receiving`)
        expect(receivingTeam).toBe('one')
    })

    it('with valid data keeping the same pulling team', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()
        await client.set(`${game._id.toString()}:${point._id.toString()}:pulling`, 'one')
        await client.set(`${game._id.toString()}:${point._id.toString()}:receiving`, 'two')

        const result = await services.setPullingTeam(game._id.toString(), point._id.toString(), TeamNumber.ONE)
        expect(result.pullingTeam.name).toBe(game.teamOne.name)
        expect(result.receivingTeam._id?.toString()).toBe(game.teamTwo._id?.toString())

        const pointRecord = await Point.findById(point._id)
        expect(pointRecord?.pullingTeam.name).toBe(game.teamOne.name)
        expect(pointRecord?.receivingTeam._id?.toString()).toBe(game.teamTwo._id?.toString())

        const pullingTeam = await client.get(`${game._id.toString()}:${point._id.toString()}:pulling`)
        expect(pullingTeam).toBe('one')
        const receivingTeam = await client.get(`${game._id.toString()}:${point._id.toString()}:receiving`)
        expect(receivingTeam).toBe('two')
    })

    it('with valid data and opposite pulling teams', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        point.pullingTeam = game.teamTwo
        point.receivingTeam = game.teamOne
        game.points.push(point._id)
        await game.save()
        await point.save()

        await client.set(`${game._id.toString()}:${point._id.toString()}:pulling`, 'two')
        await client.set(`${game._id.toString()}:${point._id.toString()}:receiving`, 'one')

        const result = await services.setPullingTeam(game._id.toString(), point._id.toString(), TeamNumber.ONE)
        expect(result.pullingTeam.name).toBe(game.teamOne.name)
        expect(result.receivingTeam.name).toBe(game.teamTwo.name)

        const pointRecord = await Point.findById(point._id)
        expect(pointRecord?.pullingTeam.name).toBe(game.teamOne.name)
        expect(pointRecord?.receivingTeam.name).toBe(game.teamTwo.name)
        const pullingTeam = await client.get(`${game._id.toString()}:${point._id.toString()}:pulling`)
        expect(pullingTeam).toBe('one')
        const receivingTeam = await client.get(`${game._id.toString()}:${point._id.toString()}:receiving`)
        expect(receivingTeam).toBe('two')
    })

    it('with unfound game', async () => {
        const point = await Point.create(createPointData)
        await expect(
            services.setPullingTeam(new Types.ObjectId().toString(), point._id.toString(), TeamNumber.TWO),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FIND_GAME, 404))
    })

    it('with unfound point', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()

        await expect(
            services.setPullingTeam(game._id.toString(), new Types.ObjectId().toString(), TeamNumber.TWO),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FIND_POINT, 404))
    })

    it('with point not in game', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)

        await expect(
            services.setPullingTeam(game._id.toString(), point._id.toString(), TeamNumber.TWO),
        ).rejects.toThrowError(new ApiError(Constants.INVALID_DATA, 400))
    })

    it('with point with mongo actions', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        point.teamOneActions.push(new Types.ObjectId())
        await point.save()
        game.points.push(point._id)
        await game.save()

        await expect(
            services.setPullingTeam(game._id.toString(), point._id.toString(), TeamNumber.TWO),
        ).rejects.toThrowError(new ApiError(Constants.MODIFY_LIVE_POINT_ERROR, 400))
    })

    it('with point with team one redis actions', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()

        await client.set(`${game._id.toString()}:${point._id.toString()}:one:actions`, 5)
        await client.set(`${getActionBaseKey(point._id.toString(), 3, 'one')}:type`, 'Score')
        await expect(
            services.setPullingTeam(game._id.toString(), point._id.toString(), TeamNumber.TWO),
        ).rejects.toThrowError(new ApiError(Constants.MODIFY_LIVE_POINT_ERROR, 400))
    })

    it('with point with team two redis actions', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()

        await client.set(`${game._id.toString()}:${point._id.toString()}:two:actions`, 5)
        await client.set(`${getActionBaseKey(point._id.toString(), 3, 'two')}:type`, 'Score')
        await expect(
            services.setPullingTeam(game._id.toString(), point._id.toString(), TeamNumber.TWO),
        ).rejects.toThrowError(new ApiError(Constants.MODIFY_LIVE_POINT_ERROR, 400))
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
        game.points.push(initialPoint._id)
        await game.save()

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
        game.points.push(initialPoint._id)
        await game.save()

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

    it('with non point not on game', async () => {
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

        await expect(
            services.setPlayers(game._id.toString(), initialPoint._id.toString(), TeamNumber.ONE, []),
        ).rejects.toThrowError(new ApiError(Constants.INVALID_DATA, 400))
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
        game.points.push(initialPoint._id)
        await game.save()

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
    it('with team one first finishing and scoring', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.teamTwoActive = true
        game.teamTwoDefined = true
        game.points.push(point._id)
        await game.save()

        const firstAction: RedisAction = {
            actionNumber: 1,
            teamNumber: TeamNumber.ONE,
            actionType: ActionType.CATCH,
            tags: [],
            comments: [],
        }

        const secondAction: RedisAction = {
            actionNumber: 2,
            teamNumber: TeamNumber.ONE,
            actionType: ActionType.TEAM_ONE_SCORE,
            tags: [],
            comments: [],
        }

        await client.set(`${game._id.toString()}:${point._id.toString()}:pulling`, 'two')
        await client.set(`${game._id.toString()}:${point._id.toString()}:receiving`, 'one')
        await client.set(`${game._id.toString()}:${point._id.toString()}:one:actions`, 2)
        await client.set(`${game._id.toString()}:${point._id.toString()}:two:actions`, 0)
        await saveRedisAction(client, firstAction, point._id.toString())
        await saveRedisAction(client, secondAction, point._id.toString())
        const result = await services.finishPoint(game._id.toString(), point._id.toString(), TeamNumber.ONE)
        expect(result.teamOneActive).toBe(false)
        expect(result.teamTwoActive).toBe(true)
        expect(result.teamOneScore).toBe(1)
        expect(result.teamTwoScore).toBe(0)
        expect(result.teamOneActions.length).toBe(2)

        const pointRecord = await Point.findById(point._id)
        const gameRecord = await Game.findById(game._id)
        expect(pointRecord?.teamOneScore).toBe(1)
        expect(gameRecord?.teamOneScore).toBe(1)
        expect(pointRecord?.teamTwoScore).toBe(0)
        expect(gameRecord?.teamTwoScore).toBe(0)

        const keys = await client.keys('*')
        expect(keys.length).toBe(3)

        const actions = await Action.find({})
        expect(actions.length).toBe(2)
    })

    it('with team two first finishing and scoring', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()

        const firstAction: RedisAction = {
            actionNumber: 1,
            teamNumber: TeamNumber.TWO,
            actionType: ActionType.CATCH,
            tags: [],
            comments: [],
        }

        const secondAction: RedisAction = {
            actionNumber: 2,
            teamNumber: TeamNumber.TWO,
            actionType: ActionType.TEAM_TWO_SCORE,
            tags: [],
            comments: [],
        }

        await client.set(`${game._id.toString()}:${point._id.toString()}:pulling`, 'one')
        await client.set(`${game._id.toString()}:${point._id.toString()}:receiving`, 'two')
        await client.set(`${game._id.toString()}:${point._id.toString()}:one:actions`, 0)
        await client.set(`${game._id.toString()}:${point._id.toString()}:two:actions`, 2)
        await saveRedisAction(client, firstAction, point._id.toString())
        await saveRedisAction(client, secondAction, point._id.toString())
        const result = await services.finishPoint(game._id.toString(), point._id.toString(), TeamNumber.TWO)
        expect(result.teamOneActive).toBe(true)
        expect(result.teamTwoActive).toBe(false)
        expect(result.teamOneScore).toBe(0)
        expect(result.teamTwoScore).toBe(1)
        expect(result.teamTwoActions.length).toBe(2)

        const pointRecord = await Point.findById(point._id)
        const gameRecord = await Game.findById(game._id)
        expect(pointRecord?.teamOneScore).toBe(0)
        expect(gameRecord?.teamOneScore).toBe(0)
        expect(pointRecord?.teamTwoScore).toBe(1)
        expect(gameRecord?.teamTwoScore).toBe(1)

        const keys = await client.keys('*')
        expect(keys.length).toBe(3)
        const actions = await Action.find({})
        expect(actions.length).toBe(2)
    })

    it('with only team finishing', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        game.teamTwoActive = false
        await game.save()
        point.teamTwoActive = false
        await point.save()

        const firstAction: RedisAction = {
            actionNumber: 1,
            teamNumber: TeamNumber.ONE,
            actionType: ActionType.CATCH,
            tags: [],
            comments: [],
        }

        const secondAction: RedisAction = {
            actionNumber: 2,
            teamNumber: TeamNumber.ONE,
            actionType: ActionType.TEAM_ONE_SCORE,
            tags: [],
            comments: [],
        }

        await client.set(`${game._id.toString()}:${point._id.toString()}:pulling`, 'two')
        await client.set(`${game._id.toString()}:${point._id.toString()}:receiving`, 'one')
        await client.set(`${game._id.toString()}:${point._id.toString()}:one:actions`, 2)
        await saveRedisAction(client, firstAction, point._id.toString())
        await saveRedisAction(client, secondAction, point._id.toString())
        const result = await services.finishPoint(game._id.toString(), point._id.toString(), TeamNumber.ONE)
        expect(result.teamOneActive).toBe(false)
        expect(result.teamTwoActive).toBe(false)
        expect(result.teamOneScore).toBe(1)
        expect(result.teamTwoScore).toBe(0)
        expect(result.teamOneActions.length).toBe(2)

        const pointRecord = await Point.findById(point._id)
        const gameRecord = await Game.findById(game._id)
        expect(pointRecord?.teamOneScore).toBe(1)
        expect(gameRecord?.teamOneScore).toBe(1)
        expect(pointRecord?.teamTwoScore).toBe(0)
        expect(gameRecord?.teamTwoScore).toBe(0)

        const keys = await client.keys('*')
        expect(keys.length).toBe(0)
        const actions = await Action.find({})
        expect(actions.length).toBe(2)
    })

    it('with previously finished point', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()

        const action = await Action.create({
            actionNumber: 1,
            actionType: ActionType.TEAM_TWO_SCORE,
            team: game.teamTwo,
            tags: [],
            comments: [],
        })
        point.teamOneActions.push(action._id)
        point.teamOneActive = false
        await point.save()

        await client.set(`${game._id.toString()}:${point._id.toString()}:two:actions`, 2)
        const result = await services.finishPoint(game._id.toString(), point._id.toString(), TeamNumber.ONE)
        expect(result.teamOneActions.length).toBe(1)
        expect(result.teamOneScore).toBe(0)
        expect(result.teamTwoScore).toBe(0)
        expect(result.teamOneActive).toBe(false)
        expect(result.teamTwoActive).toBe(true)

        const keys = await client.keys('*')
        expect(keys.length).toBe(1)
    })

    it('with unfound point', async () => {
        await expect(
            services.finishPoint(new Types.ObjectId().toString(), new Types.ObjectId().toString(), TeamNumber.ONE),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FIND_POINT, 404))
    })

    it('with unfound game', async () => {
        const point = await Point.create(createPointData)
        await expect(
            services.finishPoint(new Types.ObjectId().toString(), point._id.toString(), TeamNumber.ONE),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FIND_GAME, 404))
    })

    it('with wrong game/point id combination', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        await expect(
            services.finishPoint(game._id.toString(), point._id.toString(), TeamNumber.ONE),
        ).rejects.toThrowError(new ApiError(Constants.INVALID_DATA, 400))
    })

    it('with team one conflicting score', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()

        const action = await Action.create({
            actionNumber: 1,
            actionType: ActionType.TEAM_TWO_SCORE,
            team: game.teamTwo,
            tags: [],
            comments: [],
        })
        point.teamTwoActions.push(action._id)
        await point.save()

        const firstAction: RedisAction = {
            actionNumber: 1,
            teamNumber: TeamNumber.ONE,
            actionType: ActionType.CATCH,
            tags: [],
            comments: [],
        }

        const secondAction: RedisAction = {
            actionNumber: 2,
            teamNumber: TeamNumber.ONE,
            actionType: ActionType.TEAM_ONE_SCORE,
            tags: [],
            comments: [],
        }

        await client.set(`${game._id.toString()}:${point._id.toString()}:pulling`, 'two')
        await client.set(`${game._id.toString()}:${point._id.toString()}:receiving`, 'one')
        await client.set(`${game._id.toString()}:${point._id.toString()}:one:actions`, 2)
        await saveRedisAction(client, firstAction, point._id.toString())
        await saveRedisAction(client, secondAction, point._id.toString())

        await expect(
            services.finishPoint(game._id.toString(), point._id.toString(), TeamNumber.ONE),
        ).rejects.toThrowError(new ApiError(Constants.CONFLICTING_SCORE, 400))
    })

    it('with team two conflicting score', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()

        const action = await Action.create({
            actionNumber: 1,
            actionType: ActionType.TEAM_TWO_SCORE,
            team: game.teamTwo,
            tags: [],
            comments: [],
        })
        point.teamOneActions.push(action._id)
        await point.save()

        const firstAction: RedisAction = {
            actionNumber: 1,
            teamNumber: TeamNumber.TWO,
            actionType: ActionType.CATCH,
            tags: [],
            comments: [],
        }

        const secondAction: RedisAction = {
            actionNumber: 2,
            teamNumber: TeamNumber.TWO,
            actionType: ActionType.TEAM_ONE_SCORE,
            tags: [],
            comments: [],
        }

        await client.set(`${game._id.toString()}:${point._id.toString()}:pulling`, 'two')
        await client.set(`${game._id.toString()}:${point._id.toString()}:receiving`, 'one')
        await client.set(`${game._id.toString()}:${point._id.toString()}:one:actions`, 2)
        await saveRedisAction(client, firstAction, point._id.toString())
        await saveRedisAction(client, secondAction, point._id.toString())

        await expect(
            services.finishPoint(game._id.toString(), point._id.toString(), TeamNumber.TWO),
        ).rejects.toThrowError(new ApiError(Constants.CONFLICTING_SCORE, 400))
    })

    it('with no score', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()

        const firstAction: RedisAction = {
            actionNumber: 1,
            teamNumber: TeamNumber.ONE,
            actionType: ActionType.CATCH,
            tags: [],
            comments: [],
        }

        const secondAction: RedisAction = {
            actionNumber: 2,
            teamNumber: TeamNumber.ONE,
            actionType: ActionType.CATCH,
            tags: [],
            comments: [],
        }

        await client.set(`${game._id.toString()}:${point._id.toString()}:pulling`, 'two')
        await client.set(`${game._id.toString()}:${point._id.toString()}:receiving`, 'one')
        await client.set(`${game._id.toString()}:${point._id.toString()}:one:actions`, 2)
        await client.set(`${game._id.toString()}:${point._id.toString()}:two:actions`, 0)
        await saveRedisAction(client, firstAction, point._id.toString())
        await saveRedisAction(client, secondAction, point._id.toString())
        await expect(
            services.finishPoint(game._id.toString(), point._id.toString(), TeamNumber.ONE),
        ).rejects.toThrowError(new ApiError(Constants.SCORE_REQUIRED, 400))

        const keys = await client.keys('*')
        expect(keys.length).toBe(6)
    })
})

describe('test delete point', () => {
    it('with valid data', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()

        await client.set(`${game._id.toString()}:${point._id.toString()}:one:actions`, 0)
        await services.deletePoint(game._id.toString(), point._id.toString(), TeamNumber.ONE)

        const pointRecord = await Point.findOne({})
        expect(pointRecord).toBeNull()
        const gameRecord = await Game.findOne({})
        expect(gameRecord?.points.length).toBe(0)

        const oneTotalActions = await client.get(`${game._id.toString()}:${point._id.toString()}:one:actions`)
        expect(oneTotalActions).toBeNull()
        const twoTotalActions = await client.get(`${game._id.toString()}:${point._id.toString()}:two:actions`)
        expect(twoTotalActions).toBeNull()
    })

    it('with unfound redis total actions', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()

        await services.deletePoint(game._id.toString(), point._id.toString(), TeamNumber.ONE)

        const pointRecord = await Point.findOne({})
        expect(pointRecord).toBeNull()
        const gameRecord = await Game.findOne({})
        expect(gameRecord?.points.length).toBe(0)

        const totalActions = await client.get(`${game._id.toString()}:${point._id.toString()}:one:actions`)
        expect(totalActions).toBeNull()
    })

    it('with unfound game', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()

        await expect(
            services.deletePoint(new Types.ObjectId().toString(), point._id.toString(), TeamNumber.ONE),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FIND_GAME, 404))
    })

    it('with unfound point', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()

        await expect(
            services.deletePoint(game._id.toString(), new Types.ObjectId().toString(), TeamNumber.ONE),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FIND_POINT, 404))
    })

    it('with point not on game', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)

        await expect(
            services.deletePoint(game._id.toString(), point._id.toString(), TeamNumber.ONE),
        ).rejects.toThrowError(new ApiError(Constants.INVALID_DATA, 400))
    })

    it('with active team two', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        game.teamTwoActive = true
        await game.save()

        await expect(
            services.deletePoint(game._id.toString(), point._id.toString(), TeamNumber.ONE),
        ).rejects.toThrowError(new ApiError(Constants.MODIFY_LIVE_POINT_ERROR, 400))
    })

    it('with active team one', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()

        await expect(
            services.deletePoint(game._id.toString(), point._id.toString(), TeamNumber.TWO),
        ).rejects.toThrowError(new ApiError(Constants.MODIFY_LIVE_POINT_ERROR, 400))
    })

    it('with existing mongo actions', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()
        point.teamOneActions.push(new Types.ObjectId(), new Types.ObjectId())
        await point.save()

        await expect(
            services.deletePoint(game._id.toString(), point._id.toString(), TeamNumber.ONE),
        ).rejects.toThrowError(new ApiError(Constants.MODIFY_LIVE_POINT_ERROR, 400))
    })

    it('with existing team one actions in redis', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()

        await client.set(`${game._id.toString()}:${point._id.toString()}:one:actions`, 5)
        await client.set(`${getActionBaseKey(point._id.toString(), 3, 'one')}:type`, 'Score')
        await expect(
            services.deletePoint(game._id.toString(), point._id.toString(), TeamNumber.ONE),
        ).rejects.toThrowError(new ApiError(Constants.MODIFY_LIVE_POINT_ERROR, 400))
    })

    it('with existing team two actions in redis', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()

        await client.set(`${game._id.toString()}:${point._id.toString()}:two:actions`, 5)
        await client.set(`${getActionBaseKey(point._id.toString(), 3, 'two')}:type`, 'Score')
        await expect(
            services.deletePoint(game._id.toString(), point._id.toString(), TeamNumber.ONE),
        ).rejects.toThrowError(new ApiError(Constants.MODIFY_LIVE_POINT_ERROR, 400))
    })
})

describe('test reactivate point', () => {
    beforeEach(async () => {
        const action1 = await Action.create({
            team: {
                _id: new Types.ObjectId(),
                place: 'Place1',
                name: 'Name1',
                teamname: 'Place1Name1',
                seasonStart: new Date(),
                seasonEnd: new Date(),
            },
            actionNumber: 1,
            actionType: 'Pull',
            playerOne: { firstName: 'Name1', lastName: 'Last1' },
        })
        const action2 = await Action.create({
            team: {
                _id: new Types.ObjectId(),
                place: 'Place1',
                name: 'Name1',
                teamname: 'Place1Name1',
                seasonStart: new Date(),
                seasonEnd: new Date(),
            },
            actionNumber: 2,
            actionType: 'TeamTwoScore',
        })
        const game = await Game.create(gameData)
        const prevPoint = await Point.create({
            pointNumber: 1,
            teamOneActive: false,
            teamTwoActive: false,
            receivingTeam: {
                _id: game.teamOne._id,
                place: 'Place1',
                name: 'Name1',
                teamname: 'Place1Name1',
                seasonStart: new Date(),
                seasonEnd: new Date(),
            },
            pullingTeam: { place: 'Place2', name: 'Name2' },
            teamOneScore: 1,
            teamTwoScore: 0,
        })
        const initialPoint = await Point.create({
            pointNumber: 2,
            teamOneActive: false,
            teamTwoActive: false,
            pullingTeam: {
                _id: game.teamOne._id,
                place: 'Place1',
                name: 'Name1',
                teamname: 'Place1Name1',
                seasonStart: new Date(),
                seasonEnd: new Date(),
            },
            receivingTeam: { place: 'Place2', name: 'Name2' },
            teamOneScore: 1,
            teamTwoScore: 1,
        })
        initialPoint.teamOneActions = [action1._id, action2._id]
        await initialPoint.save()

        game.points = [prevPoint._id, initialPoint._id]
        await game.save()
    })

    it('with valid data and team one as only team', async () => {
        const game = (await Game.findOne({})) as IGame
        const initialPoint = (await Point.findById(game.points[1])) as IPoint
        const point = await services.reactivatePoint(game._id.toString(), initialPoint._id.toString(), TeamNumber.ONE)

        expect(point.teamOneActive).toBe(true)
        expect(point.teamTwoActive).toBe(false)
        expect(point.teamOneActions.length).toBe(0)
        expect(point.teamOneScore).toBe(1)
        expect(point.teamTwoScore).toBe(0)
        const gameRecord = await Game.findById(game._id)
        expect(gameRecord?.teamOneScore).toBe(1)
        expect(gameRecord?.teamTwoScore).toBe(0)

        const actionCount = await client.get(`${game._id}:${initialPoint._id}:one:actions`)
        expect(actionCount).toBe('2')
        const pullingTeam = await client.get(`${game._id}:${initialPoint._id}:pulling`)
        expect(pullingTeam).toBe('one')
        const receivingTeam = await client.get(`${game._id}:${initialPoint._id}:receiving`)
        expect(receivingTeam).toBe('two')

        const actionOne = await getRedisAction(client, initialPoint._id.toString(), 1, 'one')
        expect(actionOne.actionNumber).toBe(1)
        expect(actionOne.actionType).toBe('Pull')

        const actionTwo = await getRedisAction(client, initialPoint._id.toString(), 2, 'one')
        expect(actionTwo.actionNumber).toBe(2)
        expect(actionTwo.actionType).toBe('TeamTwoScore')
    })

    it('team two with team one saved actions', async () => {
        const [action1, action2] = await Action.find({})
        const game = await Game.findOne({})
        const initialPoint = await Point.findById(game!.points[1])
        initialPoint!.teamTwoActions = [action1._id, action2._id]
        initialPoint!.teamOneActions = [action1._id]
        initialPoint!.pullingTeam._id = undefined
        initialPoint!.receivingTeam._id = game!.teamOne._id
        await initialPoint!.save()
        game!.teamOne._id = undefined
        await game!.save()

        game!.teamOneScore = 1
        game!.teamTwoScore = 1
        await game!.save()

        const point = await services.reactivatePoint(game!._id.toString(), initialPoint!._id.toString(), TeamNumber.TWO)

        expect(point.teamOneActive).toBe(false)
        expect(point.teamTwoActive).toBe(true)
        expect(point.teamOneActions.length).toBe(1)
        expect(point.teamTwoActions.length).toBe(0)
        expect(point.teamOneScore).toBe(1)
        expect(point.teamTwoScore).toBe(1)
        const gameRecord = await Game.findById(game!._id)
        expect(gameRecord?.teamOneScore).toBe(1)
        expect(gameRecord?.teamTwoScore).toBe(1)

        const actionCount = await client.get(`${game!._id}:${initialPoint!._id}:two:actions`)
        expect(actionCount).toBe('2')
        const pullingTeam = await client.get(`${game!._id}:${initialPoint!._id}:pulling`)
        expect(pullingTeam).toBe('two')
        const receivingTeam = await client.get(`${game!._id}:${initialPoint!._id}:receiving`)
        expect(receivingTeam).toBe('one')

        const actionOne = await getRedisAction(client, initialPoint!._id.toString(), 1, 'two')
        expect(actionOne.actionNumber).toBe(1)
        expect(actionOne.actionType).toBe('Pull')

        const actionTwo = await getRedisAction(client, initialPoint!._id.toString(), 2, 'two')
        expect(actionTwo.actionNumber).toBe(2)
        expect(actionTwo.actionType).toBe('TeamTwoScore')
    })

    it('with team one and no previous point', async () => {
        const game = await Game.findOne({})
        const initialPoint = await Point.findById(game!.points[1])

        initialPoint!.pointNumber = 1
        await initialPoint!.save()
        game!.points = [initialPoint!._id]
        await game!.save()

        const point = await services.reactivatePoint(game!._id.toString(), initialPoint!._id.toString(), TeamNumber.ONE)

        expect(point.teamOneActive).toBe(true)
        expect(point.teamTwoActive).toBe(false)
        expect(point.teamOneActions.length).toBe(0)
        expect(point.teamOneScore).toBe(0)
        expect(point.teamTwoScore).toBe(0)
        const gameRecord = await Game.findById(game!._id)
        expect(gameRecord?.teamOneScore).toBe(0)
        expect(gameRecord?.teamTwoScore).toBe(0)

        const actionCount = await client.get(`${game!._id}:${initialPoint!._id}:one:actions`)
        expect(actionCount).toBe('2')

        const actionOne = await getRedisAction(client, initialPoint!._id.toString(), 1, 'one')
        expect(actionOne.actionNumber).toBe(1)
        expect(actionOne.actionType).toBe('Pull')

        const actionTwo = await getRedisAction(client, initialPoint!._id.toString(), 2, 'one')
        expect(actionTwo.actionNumber).toBe(2)
        expect(actionTwo.actionType).toBe('TeamTwoScore')
    })

    it('with unfound game', async () => {
        const game = await Game.findOne({})
        const initialPoint = await Point.findById(game!.points[1])
        await expect(
            services.reactivatePoint(new Types.ObjectId().toString(), initialPoint!._id.toString(), TeamNumber.ONE),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FIND_GAME, 404))
    })

    it('with unfound point', async () => {
        const game = await Game.findOne({})
        await expect(
            services.reactivatePoint(game!._id.toString(), new Types.ObjectId().toString(), TeamNumber.ONE),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FIND_POINT, 404))
    })

    it('with game too far back', async () => {
        const game = await Game.findOne({})
        const initialPoint = await Point.findById(game!.points[0])
        await expect(
            services.reactivatePoint(game!._id.toString(), initialPoint!._id.toString(), TeamNumber.ONE),
        ).rejects.toThrowError(new ApiError(Constants.REACTIVATE_POINT_ERROR, 400))
    })
})

describe('test get actions', () => {
    const team = {
        _id: new Types.ObjectId(),
        seasonStart: new Date(),
        seasonEnd: new Date(),
        place: 'Place 1',
        name: 'Name 1',
        teamname: 'placename',
    }
    beforeEach(async () => {
        await Action.create({
            team,
            actionNumber: 1,
            actionType: 'TeamOneScore',
        })
        await Action.create({
            team,
            actionNumber: 1,
            actionType: 'Pull',
        })
        await Action.create({
            team,
            actionNumber: 2,
            actionType: 'TeamOneScore',
        })
    })
    it('with found actions on team one', async () => {
        const [action1, action2, action3] = await Action.find({})
        const point = await Point.create({
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: team,
            receivingTeam: { name: 'Team 2' },
            teamTwoActive: false,
            teamOneActions: [action1._id, action2._id],
            teamTwoActions: [action3._id],
        })

        const actions = await services.getActionsByPoint(point._id.toString(), 'one')
        expect(actions.length).toBe(2)
        expect(actions[0].actionNumber).toBe(1)
        expect(actions[0].actionType).toBe('TeamOneScore')

        expect(actions[1].actionNumber).toBe(1)
        expect(actions[1].actionType).toBe('Pull')
    })

    it('with actions from two', async () => {
        const [action1, action2, action3] = await Action.find({})
        const point = await Point.create({
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: team,
            receivingTeam: { name: 'Team 2' },
            teamTwoActive: false,
            teamOneActions: [action1._id, action2._id],
            teamTwoActions: [action3._id],
        })

        const actions = await services.getActionsByPoint(point._id.toString(), 'two')
        expect(actions.length).toBe(1)
        expect(actions[0].actionNumber).toBe(2)
        expect(actions[0].actionType).toBe('TeamOneScore')
    })

    it('with empty array', async () => {
        const point = await Point.create({
            pointNumber: 1,
            teamOneScore: 0,
            teamTwoScore: 0,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            pullingTeam: team,
            receivingTeam: { name: 'Team 2' },
            teamTwoActive: false,
            teamOneActions: [],
            teamTwoActions: [],
        })
        const actions = await services.getActionsByPoint(point._id.toString(), 'one')
        expect(actions.length).toBe(0)
    })
})

describe('test get live actions', () => {
    it('with team one and team two actions', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()

        const action1: RedisAction = {
            actionNumber: 1,
            teamNumber: TeamNumber.ONE,
            actionType: ActionType.CATCH,
            tags: [],
            comments: [],
        }

        const action2: RedisAction = {
            actionNumber: 2,
            teamNumber: TeamNumber.TWO,
            actionType: ActionType.BLOCK,
            tags: [],
            comments: [],
        }

        const action3: RedisAction = {
            actionNumber: 3,
            teamNumber: TeamNumber.TWO,
            actionType: ActionType.DROP,
            tags: [],
            comments: [],
        }

        const action4: RedisAction = {
            actionNumber: 4,
            teamNumber: TeamNumber.ONE,
            actionType: ActionType.TEAM_ONE_SCORE,
            tags: [],
            comments: [],
        }

        await client.set(`${game._id.toString()}:${point._id.toString()}:pulling`, 'two')
        await client.set(`${game._id.toString()}:${point._id.toString()}:receiving`, 'one')
        await client.set(`${game._id.toString()}:${point._id.toString()}:one:actions`, 2)
        await client.set(`${game._id.toString()}:${point._id.toString()}:two:actions`, 2)
        await saveRedisAction(client, action1, point._id.toString())
        await saveRedisAction(client, action2, point._id.toString())
        await saveRedisAction(client, action3, point._id.toString())
        await saveRedisAction(client, action4, point._id.toString())

        const actions = await services.getLiveActionsByPoint(game._id.toString(), point._id.toString())
        expect(actions.length).toBe(4)
    })

    it('with unfound game id', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()

        await client.set(`${game._id.toString()}:${point._id.toString()}:pulling`, 'two')
        await client.set(`${game._id.toString()}:${point._id.toString()}:receiving`, 'one')
        await client.set(`${game._id.toString()}:${point._id.toString()}:one:actions`, 2)
        await client.set(`${game._id.toString()}:${point._id.toString()}:two:actions`, 2)

        const actions = await services.getLiveActionsByPoint('randomid1', point._id.toString())
        expect(actions.length).toBe(0)
    })

    it('with unfound point id', async () => {
        const game = await Game.create(createData)
        const point = await Point.create(createPointData)
        game.points.push(point._id)
        await game.save()

        await client.set(`${game._id.toString()}:${point._id.toString()}:pulling`, 'two')
        await client.set(`${game._id.toString()}:${point._id.toString()}:receiving`, 'one')
        await client.set(`${game._id.toString()}:${point._id.toString()}:one:actions`, 2)
        await client.set(`${game._id.toString()}:${point._id.toString()}:two:actions`, 2)

        const actions = await services.getLiveActionsByPoint(game._id.toString(), 'pointid')
        expect(actions.length).toBe(0)
    })
})
