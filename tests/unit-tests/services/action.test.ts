import * as Constants from '../../../src/utils/constants'
import { Types } from 'mongoose'
import Game from '../../../src/models/game'
import Point from '../../../src/models/point'
import ActionServices from '../../../src/services/v1/action'
import { ActionType, ClientAction } from '../../../src/types/action'
import { getActionBaseKey } from '../../../src/utils/utils'
import {
    setUpDatabase,
    tearDownDatabase,
    client,
    resetDatabase,
    gameData,
    createPointData,
} from '../../fixtures/setup-db'
import { saveRedisAction } from '../../../src/utils/redis'
import { parseActionData } from '../../../src/utils/action'
import axios from 'axios'
import { ApiError } from '../../../src/types/errors'

beforeAll(async () => {
    await setUpDatabase()
})

afterEach(async () => {
    await resetDatabase()
})

afterAll(async () => {
    await tearDownDatabase()
})

const services = new ActionServices(client, '', '')
describe('test create a live action', () => {
    it('with valid data', async () => {
        const game = await Game.create(gameData)
        const point = await Point.create(createPointData)
        const actionData: ClientAction = {
            pointId: point._id.toString(),
            actionType: ActionType.CATCH,
            team: createPointData.pullingTeam,
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            playerTwo: {
                _id: new Types.ObjectId(),
                firstName: 'Amy',
                lastName: 'Celuch',
                username: 'amy',
            },
            tags: ['good'],
        }

        const action = await services.createLiveAction(actionData, game._id.toString())
        expect(action._id).toBeUndefined()
        expect(action.actionNumber).toBe(1)
        expect(action.pointId.toString()).toBe(point._id.toString())
        expect(action.actionType).toBe(ActionType.CATCH)
        expect(action.playerOne?.username).toBe('noah')
        expect(action.playerTwo?.username).toBe('amy')
        expect(action.displayMessage).toBeDefined()
        expect(action.comments.length).toBe(0)
        expect(action.team.teamname).toBe(createPointData.pullingTeam.teamname)
        expect(action.tags[0]).toBe(actionData.tags[0])

        const totalActions = await client.get(`${game._id.toString()}:${actionData.pointId}:actions`)
        expect(totalActions).toBe('1')
        const baseKey = getActionBaseKey(action.pointId.toString(), action.actionNumber)
        const team = await client.hGetAll(`${baseKey}:team`)
        expect(team.id).toBe(actionData.team._id?.toString())
        expect(team.teamname).toBe(actionData.team.teamname)
        expect(team.name).toBe(actionData.team.name)
        const playerOne = await client.hGetAll(`${baseKey}:playerone`)
        expect(playerOne.username).toBe(actionData.playerOne?.username)
        const playerTwo = await client.hGetAll(`${baseKey}:playertwo`)
        expect(playerTwo.username).toBe('amy')
        expect(playerTwo.firstName).toBe('Amy')
        const actionType = await client.get(`${baseKey}:type`)
        expect(actionType).toBe(actionData.actionType)
        const displayMessage = (await client.get(`${baseKey}:display`)) as string
        expect(displayMessage).toBe(action.displayMessage)
        const tagLength = await client.lLen(`${baseKey}:tags`)
        const tags = await client.lRange(`${baseKey}:tags`, 0, tagLength)
        expect(tags[0]).toBe(actionData.tags[0])
    })

    it('with missing necessary data', async () => {
        const game = await Game.create(gameData)
        const point = await Point.create(createPointData)
        const actionData = {
            pointId: point._id.toString(),
            badKey: 7,
            team: createPointData.pullingTeam,
            tags: ['good'],
        }

        await expect(
            services.createLiveAction(actionData as unknown as ClientAction, game._id.toString()),
        ).rejects.toThrow()
    })

    it('with substitute side effect', async () => {
        const game = await Game.create(gameData)
        const point = await Point.create(createPointData)
        game.teamOne = createPointData.pullingTeam
        await game.save()

        const actionData: ClientAction = {
            pointId: point._id.toString(),
            actionType: ActionType.SUBSTITUTION,
            team: createPointData.pullingTeam,
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            playerTwo: {
                _id: new Types.ObjectId(),
                firstName: 'Amy',
                lastName: 'Celuch',
                username: 'amy',
            },
            tags: ['good'],
        }

        const action = await services.createLiveAction(actionData, game._id.toString())
        expect(action.actionNumber).toBe(1)
        expect(action.actionType).toBe(ActionType.SUBSTITUTION)
        const updatedPoint = await Point.findOne({})
        expect(updatedPoint?.teamOnePlayers.length).toBe(1)
        expect(updatedPoint?.teamOnePlayers[0].username).toBe(actionData.playerTwo?.username)
    })
})

describe('test get live action', () => {
    it('with valid data', async () => {
        await Game.create(gameData)
        const point = await Point.create(createPointData)
        const actionData: ClientAction = {
            pointId: point._id.toString(),
            actionType: ActionType.CATCH,
            team: createPointData.pullingTeam,
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            playerTwo: {
                _id: new Types.ObjectId(),
                firstName: 'Amy',
                lastName: 'Celuch',
                username: 'amy',
            },
            tags: ['good'],
        }

        await saveRedisAction(client, parseActionData(actionData, 1))
        const action = await services.getLiveAction(point._id.toString(), 1)
        expect(action._id).toBeUndefined()
        expect(action.actionNumber).toBe(1)
        expect(action.pointId.toString()).toBe(point._id.toString())
        expect(action.actionType).toBe(ActionType.CATCH)
        expect(action.playerOne?.username).toBe('noah')
        expect(action.playerTwo?.username).toBe('amy')
        expect(action.displayMessage).toBeDefined()
        expect(action.comments.length).toBe(0)
        expect(action.team.teamname).toBe(createPointData.pullingTeam.teamname)
        expect(action.tags[0]).toBe(actionData.tags[0])
    })
})

describe('test add live comment', () => {
    const userData = {
        _id: new Types.ObjectId(),
        firstName: 'Noah',
        lastName: 'Celuch',
        email: 'noah@email.com',
        username: 'noah',
        private: false,
        playerTeams: [],
        managerTeams: [],
        archiveTeams: [],
        stats: [],
        requests: [],
        openToRequests: false,
    }

    it('with valid data', async () => {
        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.resolve({ data: userData, status: 200 })
        })
        await Game.create(gameData)
        const point = await Point.create(createPointData)
        const actionData: ClientAction = {
            pointId: point._id.toString(),
            actionType: ActionType.CATCH,
            team: createPointData.pullingTeam,
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            playerTwo: {
                _id: new Types.ObjectId(),
                firstName: 'Amy',
                lastName: 'Celuch',
                username: 'amy',
            },
            tags: ['good'],
        }

        await saveRedisAction(client, parseActionData(actionData, 1))
        const action = await services.addComment(actionData.pointId, 1, { jwt: '', comment: 'That was a good play' })
        expect(action.pointId.toString()).toBe(actionData.pointId)
        expect(action.comments.length).toBe(1)
        expect(action.comments[0]).toMatchObject({
            comment: 'That was a good play',
            user: {
                _id: userData._id,
                firstName: userData.firstName,
                lastName: userData.lastName,
                username: userData.username,
            },
        })
    })

    it('with bad response', async () => {
        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.resolve({ data: {}, status: 401 })
        })
        await Game.create(gameData)
        const point = await Point.create(createPointData)
        const actionData: ClientAction = {
            pointId: point._id.toString(),
            actionType: ActionType.CATCH,
            team: createPointData.pullingTeam,
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            playerTwo: {
                _id: new Types.ObjectId(),
                firstName: 'Amy',
                lastName: 'Celuch',
                username: 'amy',
            },
            tags: ['good'],
        }

        await saveRedisAction(client, parseActionData(actionData, 1))
        await expect(
            services.addComment(actionData.pointId, 1, { jwt: '', comment: 'That was a good play' }),
        ).rejects.toThrowError(new ApiError(Constants.UNAUTHENTICATED_USER, 401))
    })

    it('with action not in redis', async () => {
        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.resolve({ data: userData, status: 200 })
        })
        await Game.create(gameData)
        const point = await Point.create(createPointData)
        const actionData: ClientAction = {
            pointId: point._id.toString(),
            actionType: ActionType.CATCH,
            team: createPointData.pullingTeam,
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            playerTwo: {
                _id: new Types.ObjectId(),
                firstName: 'Amy',
                lastName: 'Celuch',
                username: 'amy',
            },
            tags: ['good'],
        }

        await expect(
            services.addComment(actionData.pointId, 1, { jwt: '', comment: 'That was a good play' }),
        ).rejects.toThrowError(new ApiError(Constants.INVALID_DATA, 404))
    })

    it('with profane comment', async () => {
        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.resolve({ data: userData, status: 200 })
        })
        await Game.create(gameData)
        const point = await Point.create(createPointData)
        const actionData: ClientAction = {
            pointId: point._id.toString(),
            actionType: ActionType.CATCH,
            team: createPointData.pullingTeam,
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            playerTwo: {
                _id: new Types.ObjectId(),
                firstName: 'Amy',
                lastName: 'Celuch',
                username: 'amy',
            },
            tags: ['good'],
        }

        await saveRedisAction(client, parseActionData(actionData, 1))
        await expect(
            services.addComment(actionData.pointId, 1, { jwt: '', comment: 'That dude sucks ass' }),
        ).rejects.toThrowError(new ApiError(Constants.PROFANE_COMMENT, 400))
    })
})
