import * as Constants from '../../../src/utils/constants'
import { Types } from 'mongoose'
import Game from '../../../src/models/game'
import Point from '../../../src/models/point'
import ActionServices from '../../../src/services/v1/action'
import { ActionType, ClientAction, Comment, RedisAction } from '../../../src/types/action'
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
import Action from '../../../src/models/action'
import { Player } from '../../../src/types/ultmt'

beforeAll(async () => {
    await setUpDatabase()
})

afterEach(async () => {
    await resetDatabase()
})

afterAll(async () => {
    await tearDownDatabase()
})

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

const services = new ActionServices(client, '', '')
describe('test create a live action', () => {
    it('with valid data', async () => {
        const game = await Game.create(gameData)
        const point = await Point.create(createPointData)
        const actionData: ClientAction = {
            actionType: ActionType.CATCH,
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
        await client.set(`${game._id.toString()}:${point._id.toString()}:one:actions`, 0)
        await client.set(`${game._id.toString()}:${point._id.toString()}:pulling`, 'two')

        const action = await services.createLiveAction(actionData, game._id.toString(), point._id.toString(), 'one')
        expect(action.actionNumber).toBe(1)
        expect(action.actionType).toBe(ActionType.CATCH)
        expect(action.playerOne?.username).toBe('noah')
        expect(action.playerTwo?.username).toBe('amy')
        expect(action.comments.length).toBe(0)
        expect(action.tags[0]).toBe(actionData.tags[0])

        const totalActions = await client.get(`${game._id.toString()}:${point._id.toString()}:one:actions`)
        expect(totalActions).toBe('1')
        const baseKey = getActionBaseKey(point._id.toString(), action.actionNumber, 'one')
        const playerOne = await client.hGetAll(`${baseKey}:playerone`)
        expect(playerOne.username).toBe(actionData.playerOne?.username)
        const playerTwo = await client.hGetAll(`${baseKey}:playertwo`)
        expect(playerTwo.username).toBe('amy')
        expect(playerTwo.firstName).toBe('Amy')
        const actionType = await client.get(`${baseKey}:type`)
        expect(actionType).toBe(actionData.actionType)
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
            services.createLiveAction(
                actionData as unknown as ClientAction,
                game._id.toString(),
                point._id.toString(),
                'one',
            ),
        ).rejects.toThrow()
    })

    it('with substitute side effect', async () => {
        const game = await Game.create(gameData)
        const point = await Point.create(createPointData)
        game.teamOne = createPointData.pullingTeam
        await game.save()
        await client.set(`${game._id.toString()}:${point._id.toString()}:one:actions`, 1)
        await client.set(`${game._id.toString()}:${point._id.toString()}:pulling`, 'one')

        const subtituteAction: ClientAction = {
            actionType: ActionType.SUBSTITUTION,
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

        const firstAction: RedisAction = {
            actionType: ActionType.PULL,
            actionNumber: 1,
            teamNumber: 'one',
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
            comments: [],
        }

        await saveRedisAction(client, firstAction, point._id.toString())
        const action = await services.createLiveAction(
            subtituteAction,
            game._id.toString(),
            point._id.toString(),
            'one',
        )
        expect(action.actionNumber).toBe(2)
        expect(action.actionType).toBe(ActionType.SUBSTITUTION)
        const updatedPoint = await Point.findOne({})
        expect(updatedPoint?.teamOnePlayers.length).toBe(1)
        expect(updatedPoint?.teamOnePlayers[0].username).toBe(subtituteAction.playerTwo?.username)
    })

    it('with undefined point error', async () => {
        const game = await Game.create(gameData)
        const point = await Point.create(createPointData)
        const actionData: ClientAction = {
            actionType: ActionType.CATCH,
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
            services.createLiveAction(actionData, game._id.toString(), point._id.toString(), 'one'),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FIND_POINT, 404))
    })
})

describe('test get live action', () => {
    it('with valid data', async () => {
        await Game.create(gameData)
        const point = await Point.create(createPointData)
        const actionData: ClientAction = {
            actionType: ActionType.CATCH,
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

        await saveRedisAction(client, parseActionData(actionData, 1, 'one'), point._id.toString())
        const action = await services.getLiveAction(point._id.toString(), 1, 'one')
        expect(action.actionNumber).toBe(1)
        expect(action.actionType).toBe(ActionType.CATCH)
        expect(action.playerOne?.username).toBe('noah')
        expect(action.playerTwo?.username).toBe('amy')
        expect(action.comments.length).toBe(0)
        expect(action.tags[0]).toBe(actionData.tags[0])
    })
})

describe('test undo action', () => {
    it('with valid, single action', async () => {
        const game = await Game.create(gameData)
        const point = await Point.create(createPointData)
        const actionData: ClientAction = {
            actionType: ActionType.CATCH,
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

        await client.set(`${game._id.toString()}:${point._id.toString()}:one:actions`, 1)
        await saveRedisAction(client, parseActionData(actionData, 1, 'one'), point._id.toString())
        const action = await services.undoAction(game._id.toString(), point._id.toString(), 'one')
        expect(action?.actionType).toBe(actionData.actionType)
        expect(action?.tags[0]).toBe(actionData.tags[0])

        const key = getActionBaseKey(point._id.toString(), 1, 'one')
        const oldType = await client.get(`${key}:type`)
        expect(oldType).toBeNull()
        const keys = await client.keys('*')
        expect(keys.length).toBe(1)
        const totalActions = await client.get(`${game._id.toString()}:${point._id.toString()}:one:actions`)
        expect(Number(totalActions)).toBe(0)
    })

    it('with many actions', async () => {
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
            actionType: ActionType.CATCH,
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

        await client.set(`${game._id.toString()}:${point._id.toString()}:two:actions`, 4)

        await saveRedisAction(client, parseActionData(actionData, 1, 'two'), point._id.toString())
        await saveRedisAction(client, parseActionData(actionData, 2, 'two'), point._id.toString())
        actionData.actionType = ActionType.SUBSTITUTION
        await saveRedisAction(client, parseActionData(actionData, 3, 'two'), point._id.toString())
        actionData.actionType = ActionType.CATCH
        await saveRedisAction(client, parseActionData(actionData, 4, 'two'), point._id.toString())

        const action = await services.undoAction(game._id.toString(), point._id.toString(), 'two')
        expect(action?.actionNumber).toBe(4)
        expect(action?.actionType).toBe(ActionType.CATCH)
        expect(action?.tags[0]).toBe(actionData.tags[0])

        const key = getActionBaseKey(point._id.toString(), 4, 'two')
        const oldType = await client.get(`${key}:type`)
        expect(oldType).toBeNull()

        const oneKey = getActionBaseKey(point._id.toString(), 1, 'two')
        const oneType = await client.get(`${oneKey}:type`)
        expect(oneType).toBe(ActionType.CATCH)
        const twoKey = getActionBaseKey(point._id.toString(), 2, 'two')
        const twoType = await client.get(`${twoKey}:type`)
        expect(twoType).toBe(ActionType.CATCH)
        const threeKey = getActionBaseKey(point._id.toString(), 3, 'two')
        const threeType = await client.get(`${threeKey}:type`)
        expect(threeType).toBe(ActionType.SUBSTITUTION)
        const totalActions = await client.get(`${game._id.toString()}:${point._id.toString()}:two:actions`)
        expect(Number(totalActions)).toBe(3)
    })

    it('with unfound game', async () => {
        await expect(
            services.undoAction(new Types.ObjectId().toString(), new Types.ObjectId().toString(), 'one'),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FIND_GAME, 404))
    })

    it('with no action', async () => {
        const game = await Game.create(gameData)
        const point = await Point.create(createPointData)
        await client.set(`${game._id.toString()}:${point._id.toString()}:one:actions`, 1)
        const action = await services.undoAction(game._id.toString(), point._id.toString(), 'two')
        expect(action).toBeUndefined()
        const totalActions = await client.get(`${game._id.toString()}:${point._id.toString()}:one:actions`)
        expect(Number(totalActions)).toBe(1)
    })
})

describe('test add live comment', () => {
    it('with valid data', async () => {
        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.resolve({ data: { user: userData }, status: 200 })
        })
        await Game.create(gameData)
        const point = await Point.create(createPointData)
        const actionData: ClientAction = {
            actionType: ActionType.CATCH,
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

        await saveRedisAction(client, parseActionData(actionData, 1, 'two'), point._id.toString())
        const action = await services.addLiveComment(
            point._id.toString(),
            1,
            {
                jwt: '',
                comment: 'That was a good play',
            },
            'two',
        )
        expect(action.comments.length).toBe(1)
        expect(action.comments[0]).toMatchObject({
            comment: 'That was a good play',
            user: {
                _id: userData._id,
                firstName: userData.firstName,
                lastName: userData.lastName,
                username: userData.username,
            },
            commentNumber: 1,
        })
    })

    it('with bad response', async () => {
        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.resolve({ data: {}, status: 401 })
        })
        await Game.create(gameData)
        const point = await Point.create(createPointData)
        const actionData: ClientAction = {
            actionType: ActionType.CATCH,
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

        await saveRedisAction(client, parseActionData(actionData, 1, 'two'), point._id.toString())
        await expect(
            services.addLiveComment(point._id.toString(), 1, { jwt: '', comment: 'That was a good play' }, 'two'),
        ).rejects.toThrowError(new ApiError(Constants.UNAUTHENTICATED_USER, 401))
    })

    it('with action not in redis', async () => {
        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.resolve({ data: { user: userData }, status: 200 })
        })
        await Game.create(gameData)
        const point = await Point.create(createPointData)

        await expect(
            services.addLiveComment(point._id.toString(), 1, { jwt: '', comment: 'That was a good play' }, 'one'),
        ).rejects.toThrowError(new ApiError(Constants.INVALID_DATA, 404))
    })

    it('with profane comment', async () => {
        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.resolve({ data: { user: userData }, status: 200 })
        })
        await Game.create(gameData)
        const point = await Point.create(createPointData)
        const actionData: ClientAction = {
            actionType: ActionType.CATCH,
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

        await saveRedisAction(client, parseActionData(actionData, 1, 'one'), point._id.toString())
        await expect(
            services.addLiveComment(point._id.toString(), 1, { jwt: '', comment: 'That dude sucks ass' }, 'one'),
        ).rejects.toThrowError(new ApiError(Constants.PROFANE_COMMENT, 400))
    })
})

describe('test delete live comment', () => {
    it('with valid data', async () => {
        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.resolve({ data: { user: userData }, status: 200 })
        })
        await Game.create(gameData)
        const point = await Point.create(createPointData)
        const actionData: ClientAction = {
            actionType: ActionType.CATCH,
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
            commentNumber: 1,
        }

        await saveRedisAction(client, parseActionData(actionData, 1, 'one'), point._id.toString())
        const baseKey = getActionBaseKey(point._id.toString(), 1, 'one')
        const totalComments = await client.incr(`${baseKey}:comments`)
        await client.set(`${baseKey}:comments:${totalComments}:text`, comment.comment)
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'id', comment.user._id?.toString() || '')
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'username', comment.user.username || '')
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'firstName', comment.user.firstName)
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'lastName', comment.user.lastName)

        const action = await services.deleteLiveComment(point._id.toString(), 1, 1, '', 'one')
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
            actionType: ActionType.CATCH,
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
            commentNumber: 1,
        }

        await saveRedisAction(client, parseActionData(actionData, 1, 'one'), point._id.toString())
        const baseKey = getActionBaseKey(point._id.toString(), 1, 'one')
        const totalComments = await client.incr(`${baseKey}:comments`)
        await client.set(`${baseKey}:comments:${totalComments}:text`, comment.comment)
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'id', comment.user._id?.toString() || '')
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'username', comment.user.username || '')
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'firstName', comment.user.firstName)
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'lastName', comment.user.lastName)

        await expect(services.deleteLiveComment(point._id.toString(), 1, 1, '', 'one')).rejects.toThrowError(
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
            return Promise.resolve({ data: { user: { ...userData, _id: new Types.ObjectId() } }, status: 200 })
        })
        await Game.create(gameData)
        const point = await Point.create(createPointData)
        const actionData: ClientAction = {
            actionType: ActionType.CATCH,
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
            commentNumber: 1,
        }

        await saveRedisAction(client, parseActionData(actionData, 1, 'two'), point._id.toString())
        const baseKey = getActionBaseKey(point._id.toString(), 1, 'two')
        const totalComments = await client.incr(`${baseKey}:comments`)
        await client.set(`${baseKey}:comments:${totalComments}:text`, comment.comment)
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'id', comment.user._id?.toString() || '')
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'username', comment.user.username || '')
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'firstName', comment.user.firstName)
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'lastName', comment.user.lastName)

        await expect(services.deleteLiveComment(point._id.toString(), 1, 1, '', 'two')).rejects.toThrowError(
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

describe('test edit action', () => {
    it('with valid players', async () => {
        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.resolve({ data: { user: userData }, status: 200 })
        })
        const id = new Types.ObjectId()
        const player2 = {
            _id: id,
            firstName: 'First2',
            lastName: 'Last2',
            username: 'firstlast2',
        }
        const initAction = await Action.create({
            actionNumber: 1,
            actionType: 'Pull',
            team: {
                _id: new Types.ObjectId(),
                place: 'Place1',
                name: 'Name1',
                teamname: 'placename',
            },
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'First1',
                lastName: 'Last1',
                username: 'firstlast1',
            },
            playerTwo: player2,
        })

        const action = await services.editSavedAction(initAction._id.toString(), 'jwt', player2, undefined)

        expect(action.actionNumber).toBe(initAction.actionNumber)
        expect(action.actionType).toBe(initAction.actionType)
        expect(action.playerTwo).toBe(undefined)
        expect(action.playerOne?._id?.toString()).toBe(id.toString())
        expect(action.playerOne?.firstName).toBe(player2.firstName)
        expect(action.playerOne?.lastName).toBe(player2.lastName)
        expect(action.playerOne?.username).toBe(player2.username)

        const actionRecord = await Action.findById(initAction._id)

        expect(actionRecord?.actionNumber).toBe(initAction.actionNumber)
        expect(actionRecord?.actionType).toBe(initAction.actionType)
        expect(actionRecord?.playerTwo).toBe(undefined)
        expect(actionRecord?.playerOne?._id?.toString()).toBe(id.toString())
        expect(actionRecord?.playerOne?.firstName).toBe(player2.firstName)
        expect(actionRecord?.playerOne?.lastName).toBe(player2.lastName)
        expect(actionRecord?.playerOne?.username).toBe(player2.username)
    })

    it('with unfound action', async () => {
        await expect(
            services.editSavedAction(new Types.ObjectId().toString(), '', undefined, undefined),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FIND_ACTION, 404))
    })

    it('with unauthenticated user', async () => {
        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.resolve({ data: { user: userData }, status: 401 })
        })

        const initAction = await Action.create({
            actionNumber: 1,
            actionType: 'Pull',
            team: {
                _id: new Types.ObjectId(),
                place: 'Place1',
                name: 'Name1',
                teamname: 'placename',
            },
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'First1',
                lastName: 'Last1',
                username: 'firstlast1',
            },
            playerTwo: undefined,
        })
        await expect(
            services.editSavedAction(initAction._id.toString(), 'jwt', undefined, undefined),
        ).rejects.toThrowError(new ApiError(Constants.UNAUTHENTICATED_USER, 401))
    })
})

describe('test add saved comment', () => {
    it('with valid data', async () => {
        const initAction = await Action.create({
            actionNumber: 1,
            actionType: 'Pull',
            team: {
                _id: new Types.ObjectId(),
                place: 'Place1',
                name: 'Name1',
                teamname: 'placename',
            },
        })

        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.resolve({ data: { user: userData }, status: 200 })
        })

        const comment = 'Good huck!'
        const action = await services.addSavedComment(initAction._id.toString(), 'jwt', comment)

        expect(action.actionNumber).toBe(initAction.actionNumber)
        expect(action.comments.length).toBe(1)
        expect(action.comments[0].comment).toBe(comment)
        expect(action.comments[0].user._id?.toString()).toBe(userData._id.toString())
        expect(action.comments[0].user.firstName).toBe(userData.firstName.toString())
        expect(action.comments[0].user.lastName).toBe(userData.lastName.toString())
        expect(action.comments[0].user.username).toBe(userData.username.toString())

        const actionRecord = await Action.findById(initAction._id)

        expect(actionRecord?.actionNumber).toBe(initAction.actionNumber)
        expect(actionRecord?.comments.length).toBe(1)
        expect(actionRecord?.comments[0].comment).toBe(comment)
        expect(actionRecord?.comments[0].user._id?.toString()).toBe(userData._id.toString())
        expect(actionRecord?.comments[0].user.firstName).toBe(userData.firstName.toString())
        expect(actionRecord?.comments[0].user.lastName).toBe(userData.lastName.toString())
        expect(actionRecord?.comments[0].user.username).toBe(userData.username.toString())
    })

    it('with pre-existing comment', async () => {
        const initAction = await Action.create({
            actionNumber: 1,
            actionType: 'Pull',
            team: {
                _id: new Types.ObjectId(),
                place: 'Place1',
                name: 'Name1',
                teamname: 'placename',
            },
            comments: [
                {
                    comment: 'Nice!',
                    commentNumber: 7,
                    user: {
                        _id: userData._id,
                        firstName: userData.firstName,
                        lastName: userData.lastName,
                        username: userData.username,
                    },
                },
            ],
        })

        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.resolve({ data: { user: userData }, status: 200 })
        })

        const comment = 'Good huck!'
        const action = await services.addSavedComment(initAction._id.toString(), 'jwt', comment)

        expect(action.actionNumber).toBe(initAction.actionNumber)
        expect(action.comments.length).toBe(2)
        expect(action.comments[1].comment).toBe(comment)
        expect(action.comments[1].commentNumber).toBe(8)
        expect(action.comments[1].user._id?.toString()).toBe(userData._id.toString())
        expect(action.comments[1].user.firstName).toBe(userData.firstName.toString())
        expect(action.comments[1].user.lastName).toBe(userData.lastName.toString())
        expect(action.comments[1].user.username).toBe(userData.username.toString())
    })

    it('with unfound action', async () => {
        await expect(
            services.addSavedComment(new Types.ObjectId().toString(), 'jwt', 'Test comment'),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FIND_ACTION, 404))
    })

    it('with error response', async () => {
        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.reject({ data: { user: userData }, status: 401 })
        })

        const initAction = await Action.create({
            actionNumber: 1,
            actionType: 'Pull',
            team: {
                _id: new Types.ObjectId(),
                place: 'Place1',
                name: 'Name1',
                teamname: 'placename',
            },
        })

        await expect(services.addSavedComment(initAction._id.toString(), 'jwt', 'Test comment')).rejects.toThrowError(
            new ApiError(Constants.UNAUTHENTICATED_USER, 401),
        )
    })

    it('with malformed response', async () => {
        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.resolve({ data: { user: userData }, status: 401 })
        })

        const initAction = await Action.create({
            actionNumber: 1,
            actionType: 'Pull',
            team: {
                _id: new Types.ObjectId(),
                place: 'Place1',
                name: 'Name1',
                teamname: 'placename',
            },
        })

        await expect(services.addSavedComment(initAction._id.toString(), 'jwt', 'Test comment')).rejects.toThrowError(
            new ApiError(Constants.UNAUTHENTICATED_USER, 401),
        )
    })

    it('with profane comment', async () => {
        const initAction = await Action.create({
            actionNumber: 1,
            actionType: 'Pull',
            team: {
                _id: new Types.ObjectId(),
                place: 'Place1',
                name: 'Name1',
                teamname: 'placename',
            },
        })

        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.resolve({ data: { user: userData }, status: 200 })
        })

        await expect(
            services.addSavedComment(initAction._id.toString(), 'jwt', 'What a fuckin huck'),
        ).rejects.toThrowError(new ApiError(Constants.PROFANE_COMMENT, 400))
    })
})

describe('test delete saved comment', () => {
    const user: Player = {
        _id: userData._id,
        firstName: userData.firstName,
        lastName: userData.lastName,
        username: userData.username,
    }
    it('with existing comment', async () => {
        jest.spyOn(axios, 'get').mockReturnValueOnce(Promise.resolve({ data: { user: userData }, status: 200 }))
        const initAction = await Action.create({
            actionNumber: 1,
            actionType: 'Pull',
            playerOne: {
                firstName: 'First1',
                lastName: 'Last1',
            },
            team: {
                _id: new Types.ObjectId(),
                place: 'Place1',
                name: 'Name1',
                teamname: 'placename',
            },
            comments: [
                {
                    user,
                    comment: 'Good huck',
                    commentNumber: 2,
                },
            ],
        })

        const action = await services.deleteSavedComment(initAction._id.toString(), '', 2)
        expect(action.comments.length).toBe(0)
        expect(action.actionNumber).toBe(initAction.actionNumber)

        const actionRecord = await Action.findById(initAction._id)
        expect(actionRecord?.comments.length).toBe(0)
        expect(actionRecord?.actionNumber).toBe(initAction.actionNumber)
    })

    it('with multiple comments', async () => {
        jest.spyOn(axios, 'get').mockReturnValueOnce(Promise.resolve({ data: { user: userData }, status: 200 }))

        const initAction = await Action.create({
            actionNumber: 1,
            actionType: 'Pull',
            playerOne: {
                firstName: 'First1',
                lastName: 'Last1',
            },
            team: {
                _id: new Types.ObjectId(),
                place: 'Place1',
                name: 'Name1',
                teamname: 'placename',
            },
            comments: [
                {
                    user,
                    comment: 'Good huck',
                    commentNumber: 2,
                },
                {
                    user,
                    comment: 'Bad huck',
                    commentNumber: 1,
                },
            ],
        })

        const action = await services.deleteSavedComment(initAction._id.toString(), '', 2)
        expect(action.comments.length).toBe(1)
        expect(action.comments[0].comment).toBe(initAction.comments[1].comment)
        expect(action.comments[0].user._id?.toString()).toBe(initAction.comments[1].user._id?.toString())
        expect(action.comments[0].commentNumber).toBe(initAction.comments[1].commentNumber)
        expect(action.actionNumber).toBe(initAction.actionNumber)

        const actionRecord = await Action.findById(initAction._id)
        expect(actionRecord?.comments.length).toBe(1)
        expect(actionRecord?.comments[0].comment).toBe(initAction.comments[1].comment)
        expect(actionRecord?.comments[0].user._id?.toString()).toBe(initAction.comments[1].user._id?.toString())
        expect(actionRecord?.comments[0].commentNumber).toBe(initAction.comments[1].commentNumber)
        expect(actionRecord?.actionNumber).toBe(initAction.actionNumber)
    })

    it('with unfound action', async () => {
        await expect(services.deleteSavedComment(new Types.ObjectId().toString(), 'jwt', 2)).rejects.toThrowError(
            new ApiError(Constants.UNABLE_TO_FIND_ACTION, 404),
        )
    })

    it('with error response', async () => {
        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.reject({ data: { user: userData }, status: 401 })
        })

        const initAction = await Action.create({
            actionNumber: 1,
            actionType: 'Pull',
            team: {
                _id: new Types.ObjectId(),
                place: 'Place1',
                name: 'Name1',
                teamname: 'placename',
            },
        })

        await expect(services.deleteSavedComment(initAction._id.toString(), 'jwt', 2)).rejects.toThrowError(
            new ApiError(Constants.UNAUTHENTICATED_USER, 401),
        )
    })

    it('with malformed response', async () => {
        jest.spyOn(axios, 'get').mockImplementationOnce(() => {
            return Promise.resolve({ data: { user: userData }, status: 401 })
        })

        const initAction = await Action.create({
            actionNumber: 1,
            actionType: 'Pull',
            team: {
                _id: new Types.ObjectId(),
                place: 'Place1',
                name: 'Name1',
                teamname: 'placename',
            },
        })

        await expect(services.deleteSavedComment(initAction._id.toString(), 'jwt', 2)).rejects.toThrowError(
            new ApiError(Constants.UNAUTHENTICATED_USER, 401),
        )
    })
})

describe('test get actions', () => {
    beforeEach(async () => {
        const team = {
            _id: new Types.ObjectId(),
            seasonStart: new Date(),
            seasonEnd: new Date(),
            place: 'Place 1',
            name: 'Name 1',
            teamname: 'placename',
        }
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
    it('with found actions', async () => {
        const [action1, action2] = await Action.find({})
        const ids = [action1._id.toString(), action2._id.toString()]

        const actions = await services.getActions(ids)
        expect(actions.length).toBe(2)
        expect(actions[0].actionNumber).toBe(1)
        expect(actions[0].actionType).toBe('TeamOneScore')

        expect(actions[1].actionNumber).toBe(1)
        expect(actions[1].actionType).toBe('Pull')
    })

    it('with unfound actions', async () => {
        const ids = [new Types.ObjectId().toString(), new Types.ObjectId()._id.toString()]

        const actions = await services.getActions(ids)
        expect(actions.length).toBe(0)
    })

    it('with empty array', async () => {
        const actions = await services.getActions([])
        expect(actions.length).toBe(0)
    })
})
