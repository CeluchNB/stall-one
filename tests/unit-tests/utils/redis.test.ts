/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Types } from 'mongoose'
import { ActionType, Comment, RedisAction } from '../../../src/types/action'
import {
    saveRedisAction,
    getRedisAction,
    deleteRedisAction,
    saveRedisComment,
    actionExists,
    deleteRedisComment,
    getRedisComment,
    getLastRedisAction,
    isPullingTeam,
} from '../../../src/utils/redis'
import { getActionBaseKey } from '../../../src/utils/utils'
import { client, setUpDatabase, tearDownDatabase, resetDatabase } from '../../fixtures/setup-db'

beforeAll(async () => {
    await setUpDatabase()
})

afterEach(async () => {
    await resetDatabase()
})

afterAll(async () => {
    await tearDownDatabase()
})

const pointId = 'pointId'
describe('test save redis action', () => {
    it('with all data', async () => {
        const actionData: RedisAction = {
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'First',
                lastName: 'Last',
                username: 'firstlast',
            },
            playerTwo: {
                _id: new Types.ObjectId(),
                firstName: 'Last',
                lastName: 'First',
                username: 'lastfirst',
            },
            teamNumber: 'one',
            actionNumber: 1,
            actionType: ActionType.CATCH,
            comments: [],
            tags: ['good', 'huck'],
        }

        await saveRedisAction(client, actionData, pointId)

        const baseKey = getActionBaseKey(pointId, actionData.actionNumber, 'one')

        const playerOne = await client.hGetAll(`${baseKey}:playerone`)
        expect(playerOne.id).toBe(actionData.playerOne?._id?.toString())
        expect(playerOne.firstName).toBe(actionData.playerOne?.firstName)
        expect(playerOne.lastName).toBe(actionData.playerOne?.lastName)
        expect(playerOne.username).toBe(actionData.playerOne?.username)

        const playerTwo = await client.hGetAll(`${baseKey}:playertwo`)
        expect(playerTwo.id).toBe(actionData.playerTwo?._id?.toString())
        expect(playerTwo.firstName).toBe(actionData.playerTwo?.firstName)
        expect(playerTwo.lastName).toBe(actionData.playerTwo?.lastName)
        expect(playerTwo.username).toBe(actionData.playerTwo?.username)

        const type = await client.get(`${baseKey}:type`)
        expect(type).toBe(actionData.actionType)

        const tagLength = await client.lLen(`${baseKey}:tags`)
        const tags = await client.lRange(`${baseKey}:tags`, 0, tagLength)
        expect(tags.length).toBe(2)
        expect(tags[0]).toBe(actionData.tags[0])
        expect(tags[1]).toBe(actionData.tags[1])
    })

    it('without players', async () => {
        const actionData: RedisAction = {
            teamNumber: 'one',
            actionNumber: 1,
            actionType: ActionType.TIMEOUT,
            comments: [],
            tags: ['veteran call'],
        }

        await saveRedisAction(client, actionData, pointId)

        const baseKey = getActionBaseKey(pointId, actionData.actionNumber, 'one')
        const totalKeys = await client.keys('*')
        expect(totalKeys.length).toBe(2)

        const playerOne = await client.hGetAll(`${baseKey}:playerone`)
        expect(playerOne).toMatchObject({})

        const playerTwo = await client.hGetAll(`${baseKey}:playertwo`)
        expect(playerTwo).toMatchObject({})

        const type = await client.get(`${baseKey}:type`)
        expect(type).toBe(actionData.actionType)

        const tagLength = await client.lLen(`${baseKey}:tags`)
        const tags = await client.lRange(`${baseKey}:tags`, 0, tagLength)
        expect(tags.length).toBe(1)
        expect(tags[0]).toBe(actionData.tags[0])
    })

    it('with minimal data', async () => {
        const actionData: RedisAction = {
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'First',
                lastName: 'Last',
                username: 'firstlast',
            },
            playerTwo: {
                _id: new Types.ObjectId(),
                firstName: 'Last',
                lastName: 'First',
                username: 'lastfirst',
            },
            teamNumber: 'one',
            actionNumber: 1,
            actionType: ActionType.CATCH,
            comments: [],
            tags: ['good', 'huck'],
        }

        await saveRedisAction(client, actionData, pointId)

        const baseKey = getActionBaseKey(pointId, actionData.actionNumber, 'one')
        const totalKeys = await client.keys('*')
        expect(totalKeys.length).toBe(4)

        const playerOne = await client.hGetAll(`${baseKey}:playerone`)
        expect(playerOne.id).toBeDefined()
        expect(playerOne.firstName).toBe(actionData.playerOne?.firstName)
        expect(playerOne.lastName).toBe(actionData.playerOne?.lastName)
        expect(playerOne.username).toBe('firstlast')

        const playerTwo = await client.hGetAll(`${baseKey}:playertwo`)
        expect(playerTwo.id).toBeDefined()
        expect(playerTwo.firstName).toBe(actionData.playerTwo?.firstName)
        expect(playerTwo.lastName).toBe(actionData.playerTwo?.lastName)
        expect(playerTwo.username).toBe('lastfirst')

        const type = await client.get(`${baseKey}:type`)
        expect(type).toBe(actionData.actionType)

        const tagLength = await client.lLen(`${baseKey}:tags`)
        const tags = await client.lRange(`${baseKey}:tags`, 0, tagLength)
        expect(tags.length).toBe(2)
        expect(tags[0]).toBe(actionData.tags[0])
        expect(tags[1]).toBe(actionData.tags[1])
    })
})

describe('test get redis action', () => {
    it('with all data', async () => {
        const actionData: RedisAction = {
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'First',
                lastName: 'Last',
                username: 'firstlast',
            },
            playerTwo: {
                _id: new Types.ObjectId(),
                firstName: 'Last',
                lastName: 'First',
                username: 'lastfirst',
            },
            teamNumber: 'one',
            actionNumber: 1,
            actionType: ActionType.CATCH,
            comments: [],
            tags: ['good', 'huck'],
        }

        const baseKey = getActionBaseKey(pointId, actionData.actionNumber, 'one')
        await client.set(`${baseKey}:type`, actionData.actionType)
        await client.hSet(`${baseKey}:playerone`, 'id', actionData.playerOne!._id!.toString())
        await client.hSet(`${baseKey}:playerone`, 'firstName', actionData.playerOne!.firstName)
        await client.hSet(`${baseKey}:playerone`, 'lastName', actionData.playerOne!.lastName)
        await client.hSet(`${baseKey}:playerone`, 'username', actionData.playerOne!.username!)
        await client.hSet(`${baseKey}:playertwo`, 'id', actionData.playerTwo!._id!.toString())
        await client.hSet(`${baseKey}:playertwo`, 'firstName', actionData.playerTwo!.firstName)
        await client.hSet(`${baseKey}:playertwo`, 'lastName', actionData.playerTwo!.lastName)
        await client.hSet(`${baseKey}:playertwo`, 'username', actionData.playerTwo!.username!)
        for (const tag of actionData.tags) {
            await client.rPush(`${baseKey}:tags`, tag)
        }
        await client.set(`${baseKey}:comments`, 1)
        await client.set(`${baseKey}:comments:1:text`, 'Good play')
        await client.hSet(`${baseKey}:comments:1:user`, 'id', actionData.playerOne!._id!.toString())
        await client.hSet(`${baseKey}:comments:1:user`, 'firstName', actionData.playerOne!.firstName)
        await client.hSet(`${baseKey}:comments:1:user`, 'lastName', actionData.playerOne!.lastName)
        await client.hSet(`${baseKey}:comments:1:user`, 'username', actionData.playerOne!.username!)

        const action = await getRedisAction(client, pointId, actionData.actionNumber, 'one')
        expect(action.actionType).toBe(actionData.actionType)
        expect(action.actionNumber).toBe(actionData.actionNumber)
        expect(action.playerOne?._id?.toString()).toBe(actionData.playerOne?._id?.toString())
        expect(action.playerOne?.firstName).toBe(actionData.playerOne?.firstName)
        expect(action.playerOne?.lastName).toBe(actionData.playerOne?.lastName)
        expect(action.playerOne?.username).toBe(actionData.playerOne?.username)
        expect(action.playerTwo?._id?.toString()).toBe(actionData.playerTwo?._id?.toString())
        expect(action.playerTwo?.firstName).toBe(actionData.playerTwo?.firstName)
        expect(action.playerTwo?.lastName).toBe(actionData.playerTwo?.lastName)
        expect(action.playerTwo?.username).toBe(actionData.playerTwo?.username)
        expect(action.tags.length).toBe(actionData.tags.length)
        expect(action.tags[0]).toBe(actionData.tags[0])
        expect(action.tags[1]).toBe(actionData.tags[1])
        expect(action.comments.length).toBe(1)
        expect(action.comments[0]).toMatchObject({
            comment: 'Good play',
            user: {
                _id: actionData.playerOne?._id,
                firstName: actionData.playerOne?.firstName,
                lastName: actionData.playerOne?.lastName,
                username: actionData.playerOne?.username,
            },
        })
    })

    it('with no players', async () => {
        const actionData: RedisAction = {
            teamNumber: 'one',
            actionNumber: 1,
            actionType: ActionType.CATCH,
            comments: [],
            tags: ['good', 'huck'],
        }

        const baseKey = getActionBaseKey(pointId, actionData.actionNumber, 'one')
        await client.set(`${baseKey}:type`, actionData.actionType)
        for (const tag of actionData.tags) {
            await client.rPush(`${baseKey}:tags`, tag)
        }

        const action = await getRedisAction(client, pointId, actionData.actionNumber, 'one')
        expect(action.actionType).toBe(actionData.actionType)
        expect(action.actionNumber).toBe(actionData.actionNumber)
        expect(action.playerOne).toBeUndefined()
        expect(action.playerTwo).toBeUndefined()
        expect(action.tags.length).toBe(actionData.tags.length)
        expect(action.tags[0]).toBe(actionData.tags[0])
        expect(action.tags[1]).toBe(actionData.tags[1])
        expect(action.comments.length).toBe(0)
    })

    it('with minimal data', async () => {
        const actionData: RedisAction = {
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'First',
                lastName: 'Last',
                username: 'firstlast',
            },
            playerTwo: {
                _id: new Types.ObjectId(),
                firstName: 'Last',
                lastName: 'First',
                username: 'lastfirst',
            },
            teamNumber: 'one',
            actionNumber: 1,
            actionType: ActionType.CATCH,
            comments: [],
            tags: ['good', 'huck'],
        }

        const baseKey = getActionBaseKey(pointId, actionData.actionNumber, 'one')
        await client.set(`${baseKey}:type`, actionData.actionType)
        await client.hSet(`${baseKey}:playerone`, 'id', actionData.playerOne!._id.toString())
        await client.hSet(`${baseKey}:playerone`, 'firstName', actionData.playerOne!.firstName)
        await client.hSet(`${baseKey}:playerone`, 'lastName', actionData.playerOne!.lastName)
        await client.hSet(`${baseKey}:playerone`, 'username', actionData.playerOne!.username)
        await client.hSet(`${baseKey}:playertwo`, 'id', actionData.playerOne!._id.toString())
        await client.hSet(`${baseKey}:playertwo`, 'firstName', actionData.playerTwo!.firstName)
        await client.hSet(`${baseKey}:playertwo`, 'lastName', actionData.playerTwo!.lastName)
        await client.hSet(`${baseKey}:playertwo`, 'username', actionData.playerTwo!.username)
        for (const tag of actionData.tags) {
            await client.rPush(`${baseKey}:tags`, tag)
        }

        const action = await getRedisAction(client, pointId, actionData.actionNumber, 'one')
        expect(action.actionType).toBe(actionData.actionType)
        expect(action.actionNumber).toBe(actionData.actionNumber)
        expect(action.playerOne?._id).toBeDefined()
        expect(action.playerOne?.firstName).toBe(actionData.playerOne?.firstName)
        expect(action.playerOne?.lastName).toBe(actionData.playerOne?.lastName)
        expect(action.playerOne?.username).toBe('firstlast')
        expect(action.playerTwo?._id).toBeDefined()
        expect(action.playerTwo?.firstName).toBe(actionData.playerTwo?.firstName)
        expect(action.playerTwo?.lastName).toBe(actionData.playerTwo?.lastName)
        expect(action.playerTwo?.username).toBe('lastfirst')
        expect(action.tags.length).toBe(actionData.tags.length)
        expect(action.tags[0]).toBe(actionData.tags[0])
        expect(action.tags[1]).toBe(actionData.tags[1])
        expect(action.comments.length).toBe(0)
    })
})

describe('test delete redis action', () => {
    it('delete all data', async () => {
        const actionData: RedisAction = {
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'First',
                lastName: 'Last',
                username: 'firstlast',
            },
            playerTwo: {
                _id: new Types.ObjectId(),
                firstName: 'Last',
                lastName: 'First',
                username: 'lastfirst',
            },
            teamNumber: 'one',
            actionNumber: 1,
            actionType: ActionType.CATCH,
            comments: [],
            tags: ['good', 'huck'],
        }

        const baseKey = getActionBaseKey(pointId, actionData.actionNumber, 'one')
        await client.set(`${baseKey}:type`, actionData.actionType)
        await client.hSet(`${baseKey}:playerone`, 'id', actionData.playerOne!._id!.toString())
        await client.hSet(`${baseKey}:playerone`, 'firstName', actionData.playerOne!.firstName)
        await client.hSet(`${baseKey}:playerone`, 'lastName', actionData.playerOne!.lastName)
        await client.hSet(`${baseKey}:playerone`, 'username', actionData.playerOne!.username!)
        await client.hSet(`${baseKey}:playertwo`, 'id', actionData.playerTwo!._id!.toString())
        await client.hSet(`${baseKey}:playertwo`, 'firstName', actionData.playerTwo!.firstName)
        await client.hSet(`${baseKey}:playertwo`, 'lastName', actionData.playerTwo!.lastName)
        await client.hSet(`${baseKey}:playertwo`, 'username', actionData.playerTwo!.username!)
        for (const tag of actionData.tags) {
            await client.rPush(`${baseKey}:tags`, tag)
        }

        await deleteRedisAction(client, pointId, actionData.actionNumber, 'one')
        const type = await client.get(`${baseKey}:type`)
        const playerOne = await client.hGetAll(`${baseKey}:playerone`)
        const playerTwo = await client.hGetAll(`${baseKey}:playertwo`)
        expect(type).toBeNull()
        expect(playerOne).toMatchObject({})
        expect(playerTwo).toMatchObject({})
    })

    it('with no previously existing data', async () => {
        const actionData: RedisAction = {
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'First',
                lastName: 'Last',
                username: 'firstlast',
            },
            playerTwo: {
                _id: new Types.ObjectId(),
                firstName: 'Last',
                lastName: 'First',
                username: 'lastfirst',
            },
            teamNumber: 'one',
            actionNumber: 1,
            actionType: ActionType.CATCH,
            comments: [],
            tags: ['good', 'huck'],
        }
        await deleteRedisAction(client, pointId, actionData.actionNumber, 'one')

        const baseKey = getActionBaseKey(pointId, actionData.actionNumber, 'one')
        const type = await client.get(`${baseKey}:type`)
        const playerOne = await client.hGetAll(`${baseKey}:playerone`)
        const playerTwo = await client.hGetAll(`${baseKey}:playertwo`)
        expect(type).toBeNull()
        expect(playerOne).toMatchObject({})
        expect(playerTwo).toMatchObject({})
    })
})

describe('test save redis comment', () => {
    it('with all data', async () => {
        const commentData: Comment = {
            comment: 'That was a wild huck',
            user: { _id: new Types.ObjectId(), firstName: 'Noah', lastName: 'Celuch', username: 'noah' },
            commentNumber: 1,
        }
        await saveRedisComment(client, 'point1', 1, commentData, 'one')
        const key = getActionBaseKey('point1', 1, 'one')

        const totalComments = await client.get(`${key}:comments`)
        const comment = await client.get(`${key}:comments:1:text`)
        const user = await client.hGetAll(`${key}:comments:1:user`)
        expect(totalComments).toBe('1')
        expect(comment).toBe(commentData.comment)
        expect(user.id).toBe(commentData.user._id?.toString())
        expect(user.firstName).toBe(commentData.user.firstName)
        expect(user.lastName).toBe(commentData.user.lastName)
        expect(user.username).toBe(commentData.user.username)
    })

    it('without unnecessary user properties', async () => {
        const commentData: Comment = {
            comment: 'That was a wild huck',
            user: { _id: new Types.ObjectId(), firstName: 'Noah', lastName: 'Celuch', username: 'noah' },
            commentNumber: 1,
        }
        await saveRedisComment(client, 'point1', 1, commentData, 'one')
        const key = getActionBaseKey('point1', 1, 'one')

        const totalComments = await client.get(`${key}:comments`)
        const comment = await client.get(`${key}:comments:1:text`)
        const user = await client.hGetAll(`${key}:comments:1:user`)
        expect(totalComments).toBe('1')
        expect(comment).toBe(commentData.comment)
        expect(user.id).toBeDefined()
        expect(user.firstName).toBe(commentData.user.firstName)
        expect(user.lastName).toBe(commentData.user.lastName)
        expect(user.username).toBe('noah')
    })
})

describe('test delete redis comment', () => {
    it('with existing comment', async () => {
        const data: Comment = {
            comment: 'That was a wild huck',
            user: { _id: new Types.ObjectId(), username: 'noah', firstName: 'Noah', lastName: 'Celuch' },
            commentNumber: 1,
        }
        const pointId = 'point1'
        const actionNumber = 1
        const baseKey = getActionBaseKey(pointId, actionNumber, 'one')
        const totalComments = await client.incr(`${baseKey}:comments`)
        await client.set(`${baseKey}:comments:${totalComments}:text`, data.comment)
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'id', data.user._id?.toString() || '')
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'username', data.user.username || '')
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'firstName', data.user.firstName)
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'lastName', data.user.lastName)

        await deleteRedisComment(client, 'point1', 1, 1, 'one')

        const comment = await client.get(`${baseKey}:comments:${totalComments}:text`)
        const user = await client.hGetAll(`${baseKey}:comments:${totalComments}:user`)
        const newTotal = await client.get(`${baseKey}:comments`)
        expect(comment).toBeNull()
        expect(user).toMatchObject({})
        expect(newTotal).toBe('1')
    })

    it('with non-existing comment', async () => {
        const pointId = 'point1'
        const actionNumber = 1
        const baseKey = getActionBaseKey(pointId, actionNumber, 'one')
        const totalComments = 0
        await deleteRedisComment(client, 'point1', 1, 1, 'one')

        const comment = await client.get(`${baseKey}:comments:${totalComments}:text`)
        const user = await client.hGetAll(`${baseKey}:comments:${totalComments}:user`)
        expect(comment).toBeNull()
        expect(user).toMatchObject({})
    })
})

describe('test get redis comment', () => {
    it('with existing comment', async () => {
        const data: Comment = {
            comment: 'That was a wild huck',
            user: { _id: new Types.ObjectId(), username: 'noah', firstName: 'Noah', lastName: 'Celuch' },
            commentNumber: 1,
        }
        const pointId = 'point1'
        const actionNumber = 1
        const baseKey = getActionBaseKey(pointId, actionNumber, 'one')
        const totalComments = await client.incr(`${baseKey}:comments`)
        await client.set(`${baseKey}:comments:${totalComments}:text`, data.comment)
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'id', data.user._id?.toString() || '')
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'username', data.user.username || '')
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'firstName', data.user.firstName)
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'lastName', data.user.lastName)

        const comment = await getRedisComment(client, 'point1', 1, 1, 'one')
        expect(comment?.comment).toBe(data.comment)
        expect(comment?.user).toMatchObject(data.user)
    })

    it('with non-existent text', async () => {
        const data: Comment = {
            comment: 'That was a wild huck',
            user: { _id: new Types.ObjectId(), username: 'noah', firstName: 'Noah', lastName: 'Celuch' },
            commentNumber: 1,
        }
        const pointId = 'point1'
        const actionNumber = 1
        const baseKey = getActionBaseKey(pointId, actionNumber, 'one')
        const totalComments = await client.incr(`${baseKey}:comments`)
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'id', data.user._id?.toString() || '')
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'username', data.user.username || '')
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'firstName', data.user.firstName)
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'lastName', data.user.lastName)

        const comment = await getRedisComment(client, 'point1', 1, 1, 'one')
        expect(comment).toBeUndefined()
    })

    it('with non-existent user', async () => {
        const data: Comment = {
            comment: 'That was a wild huck',
            user: { _id: new Types.ObjectId(), username: 'noah', firstName: 'Noah', lastName: 'Celuch' },
            commentNumber: 1,
        }
        const pointId = 'point1'
        const actionNumber = 1
        const baseKey = getActionBaseKey(pointId, actionNumber, 'one')
        const totalComments = await client.incr(`${baseKey}:comments`)
        await client.set(`${baseKey}:comments:${totalComments}:text`, data.comment)

        const comment = await getRedisComment(client, 'point1', 1, 1, 'one')
        expect(comment).toBeUndefined()
    })
})

describe('test action exists', () => {
    it('with existing action', async () => {
        const key = getActionBaseKey('point1', 2, 'one')
        await client.set(`${key}:type`, 'SCORE')
        const exists = await actionExists(client, 'point1', 2, 'one')
        expect(exists).toBe(true)
    })

    it('with non-existing action', async () => {
        const exists = await actionExists(client, 'point1', 2, 'one')
        expect(exists).toBe(false)
    })
})

describe('test get previous result', () => {
    it('should get first action when passed number two', async () => {
        const actionData: RedisAction = {
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'First',
                lastName: 'Last',
                username: 'firstlast',
            },
            playerTwo: {
                _id: new Types.ObjectId(),
                firstName: 'Last',
                lastName: 'First',
                username: 'lastfirst',
            },
            teamNumber: 'one',
            actionNumber: 1,
            actionType: ActionType.CATCH,
            comments: [],
            tags: ['good', 'huck'],
        }

        await saveRedisAction(client, actionData, pointId)
        await client.set(`gameone:${pointId}:one:actions`, 1)
        const prevAction = await getLastRedisAction(client, 'gameone', pointId, 'one')
        expect(prevAction?.playerOne?.username).toBe(actionData.playerOne?.username)
        expect(prevAction?.playerTwo?.username).toBe(actionData.playerTwo?.username)
        expect(prevAction?.teamNumber).toBe(actionData.teamNumber)
        expect(prevAction?.actionNumber).toBe(actionData.actionNumber)
        expect(prevAction?.actionType).toBe(actionData.actionType)
        expect(prevAction?.tags.length).toBe(2)
    })

    it('should return undefined with no action number stored', async () => {
        const prevAction = await getLastRedisAction(client, 'gameone', pointId, 'one')
        expect(prevAction).toBeUndefined()
    })

    it('should return undefined with no action stored', async () => {
        await client.set(`gameone:${pointId}:one:actions`, 1)
        const prevAction = await getLastRedisAction(client, 'gameone', pointId, 'one')
        expect(prevAction).toBeUndefined()
    })
})

describe('test get pulling team', () => {
    it('with team one calling', async () => {
        await client.set(`gameone:${pointId}:pulling`, 'one')
        await client.set(`gameone:${pointId}:receiving`, 'two')
        const isPulling = await isPullingTeam(client, 'gameone', pointId, 'one')
        expect(isPulling).toBe(true)
    })

    it('with team two calling', async () => {
        await client.set(`gameone:${pointId}:pulling`, 'one')
        await client.set(`gameone:${pointId}:receiving`, 'two')
        const isPulling = await isPullingTeam(client, 'gameone', pointId, 'two')
        expect(isPulling).toBe(false)
    })
})
