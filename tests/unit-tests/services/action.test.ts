import * as Constants from '../../../src/utils/constants'
import { Types } from 'mongoose'
import Game from '../../../src/models/game'
import Point from '../../../src/models/point'
import ActionServices from '../../../src/services/v1/action'
import { ActionType, ClientAction, Comment } from '../../../src/types/action'
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

describe('test undo action', () => {
    it('with valid, single action', async () => {
        const game = await Game.create(gameData)
        const point = await Point.create(createPointData)
        const actionData: ClientAction = {
            pointId: point._id.toString(),
            actionType: ActionType.CATCH,
            team: game.teamOne,
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

        await client.set(`${game._id.toString()}:${actionData.pointId}:actions`, 1)
        await saveRedisAction(client, parseActionData(actionData, 1))
        const action = await services.undoAction(game._id.toString(), point._id.toString(), 'one')
        expect(action?.pointId.toString()).toBe(actionData.pointId)
        expect(action?.actionType).toBe(actionData.actionType)
        expect(action?.tags[0]).toBe(actionData.tags[0])

        const key = getActionBaseKey(actionData.pointId, 1)
        const oldType = await client.get(`${key}:type`)
        const oldTeam = await client.hGetAll(`${key}:team`)
        expect(oldType).toBeNull()
        expect(oldTeam).toMatchObject({})
        const keys = await client.keys('*')
        expect(keys.length).toBe(1)
    })

    it('with valid action many behind other tema', async () => {
        const game = await Game.create(gameData)
        game.teamTwo = {
            _id: new Types.ObjectId(),
            name: 'Team 2',
            place: 'Place 2',
            teamname: '2',
        }
        await game.save()
        const point = await Point.create(createPointData)
        const actionData: ClientAction = {
            pointId: point._id.toString(),
            actionType: ActionType.CATCH,
            team: game.teamOne,
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

        await client.set(`${game._id.toString()}:${actionData.pointId}:actions`, 4)

        await saveRedisAction(client, parseActionData(actionData, 2))
        await saveRedisAction(client, parseActionData(actionData, 3))
        actionData.actionType = ActionType.SUBSTITUTION
        await saveRedisAction(client, parseActionData(actionData, 4))
        actionData.actionType = ActionType.CATCH
        actionData.team = game.teamTwo
        await saveRedisAction(client, parseActionData(actionData, 1))

        const action = await services.undoAction(game._id.toString(), point._id.toString(), 'two')
        expect(action?.actionNumber).toBe(1)
        expect(action?.actionType).toBe(ActionType.CATCH)
        expect(action?.pointId.toString()).toBe(actionData.pointId)
        expect(action?.tags[0]).toBe(actionData.tags[0])

        const key = getActionBaseKey(actionData.pointId, 1)
        const oldType = await client.get(`${key}:type`)
        const oldTeam = await client.hGetAll(`${key}:team`)
        expect(oldType).toBeNull()
        expect(oldTeam).toMatchObject({})

        const twoKey = getActionBaseKey(actionData.pointId, 2)
        const twoType = await client.get(`${twoKey}:type`)
        expect(twoType).toBe(ActionType.CATCH)
        const threeKey = getActionBaseKey(actionData.pointId, 3)
        const threeType = await client.get(`${threeKey}:type`)
        expect(threeType).toBe(ActionType.CATCH)
        const fourKey = getActionBaseKey(actionData.pointId, 4)
        const fourType = await client.get(`${fourKey}:type`)
        expect(fourType).toBe(ActionType.SUBSTITUTION)
    })

    it('with unfound game', async () => {
        await expect(
            services.undoAction(new Types.ObjectId().toString(), new Types.ObjectId().toString(), 'one'),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FIND_GAME, 404))
    })

    it('with invalid team two', async () => {
        const game = await Game.create(gameData)
        const point = await Point.create(createPointData)
        const actionData: ClientAction = {
            pointId: point._id.toString(),
            actionType: ActionType.CATCH,
            team: game.teamOne,
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

        await expect(services.undoAction(game._id.toString(), actionData.pointId, 'two')).rejects.toThrowError(
            new ApiError(Constants.INVALID_DATA, 404),
        )
    })

    it('with no action', async () => {
        const game = await Game.create(gameData)
        const point = await Point.create(createPointData)
        await client.set(`${game._id.toString()}:${point._id.toString()}:actions`, 1)
        const action = await services.undoAction(game._id.toString(), point._id.toString(), 'one')
        expect(action).toBeUndefined()
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
        const action = await services.addLiveComment(actionData.pointId, 1, {
            jwt: '',
            comment: 'That was a good play',
        })
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
            services.addLiveComment(actionData.pointId, 1, { jwt: '', comment: 'That was a good play' }),
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
            services.addLiveComment(actionData.pointId, 1, { jwt: '', comment: 'That was a good play' }),
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
            services.addLiveComment(actionData.pointId, 1, { jwt: '', comment: 'That dude sucks ass' }),
        ).rejects.toThrowError(new ApiError(Constants.PROFANE_COMMENT, 400))
    })
})

describe('test delete live comment', () => {
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

        const comment: Comment = {
            comment: 'Good huck',
            user: {
                _id: userData._id,
                firstName: userData.firstName,
                lastName: userData.lastName,
                username: userData.username,
            },
        }

        await saveRedisAction(client, parseActionData(actionData, 1))
        const baseKey = getActionBaseKey(actionData.pointId, 1)
        const totalComments = await client.incr(`${baseKey}:comments`)
        await client.set(`${baseKey}:comments:${totalComments}:text`, comment.comment)
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'id', comment.user._id?.toString() || '')
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'username', comment.user.username || '')
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'firstName', comment.user.firstName)
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'lastName', comment.user.lastName)

        const action = await services.deleteLiveComment(actionData.pointId, 1, 1, '')
        expect(action.pointId.toString()).toBe(actionData.pointId.toString())
        expect(action.actionType).toBe(actionData.actionType)
        expect(action.comments.length).toBe(0)

        const commentText = await client.get(`${baseKey}:comments:${totalComments}:text`)
        const commentUser = await client.hGetAll(`${baseKey}:comments:${totalComments}:user`)
        const commentTotal = await client.get(`${baseKey}:comments`)

        expect(commentText).toBeNull()
        expect(commentUser).toMatchObject({})
        expect(commentTotal).toBe('1')
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

        const comment: Comment = {
            comment: 'Good huck',
            user: {
                _id: userData._id,
                firstName: userData.firstName,
                lastName: userData.lastName,
                username: userData.username,
            },
        }

        await saveRedisAction(client, parseActionData(actionData, 1))
        const baseKey = getActionBaseKey(actionData.pointId, 1)
        const totalComments = await client.incr(`${baseKey}:comments`)
        await client.set(`${baseKey}:comments:${totalComments}:text`, comment.comment)
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'id', comment.user._id?.toString() || '')
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'username', comment.user.username || '')
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'firstName', comment.user.firstName)
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'lastName', comment.user.lastName)

        await expect(services.deleteLiveComment(actionData.pointId, 1, 1, '')).rejects.toThrowError(
            new ApiError(Constants.UNAUTHENTICATED_USER, 401),
        )

        const commentText = await client.get(`${baseKey}:comments:${totalComments}:text`)
        const commentUser = await client.hGetAll(`${baseKey}:comments:${totalComments}:user`)
        const commentTotal = await client.get(`${baseKey}:comments`)

        expect(commentText).toBe(comment.comment)
        expect(commentUser.id?.toString()).toBe(comment.user._id?.toString())
        expect(commentTotal).toBe('1')
    })

    it('with non-matching user', async () => {
        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.resolve({ data: { ...userData, _id: new Types.ObjectId() }, status: 200 })
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

        const comment: Comment = {
            comment: 'Good huck',
            user: {
                _id: userData._id,
                firstName: userData.firstName,
                lastName: userData.lastName,
                username: userData.username,
            },
        }

        await saveRedisAction(client, parseActionData(actionData, 1))
        const baseKey = getActionBaseKey(actionData.pointId, 1)
        const totalComments = await client.incr(`${baseKey}:comments`)
        await client.set(`${baseKey}:comments:${totalComments}:text`, comment.comment)
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'id', comment.user._id?.toString() || '')
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'username', comment.user.username || '')
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'firstName', comment.user.firstName)
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'lastName', comment.user.lastName)

        await expect(services.deleteLiveComment(actionData.pointId, 1, 1, '')).rejects.toThrowError(
            new ApiError(Constants.UNAUTHENTICATED_USER, 401),
        )

        const commentText = await client.get(`${baseKey}:comments:${totalComments}:text`)
        const commentUser = await client.hGetAll(`${baseKey}:comments:${totalComments}:user`)
        const commentTotal = await client.get(`${baseKey}:comments`)

        expect(commentText).toBe(comment.comment)
        expect(commentUser.id?.toString()).toBe(comment.user._id?.toString())
        expect(commentTotal).toBe('1')
    })
})
