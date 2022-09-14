/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Types } from 'mongoose'
import IAction, { ActionType, Comment } from '../../../src/types/action'
import {
    saveRedisAction,
    getRedisAction,
    deleteRedisAction,
    saveRedisComment,
    actionExists,
    deleteRedisComment,
    getRedisComment,
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

describe('test save redis action', () => {
    it('with all data', async () => {
        const actionData: IAction = {
            _id: new Types.ObjectId(),
            team: {
                _id: new Types.ObjectId(),
                place: 'San Francisco',
                name: 'Sockeye',
                teamname: 'sfsockeye',
                seasonStart: new Date(2022),
                seasonEnd: new Date(2022),
            },
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
            pointId: new Types.ObjectId(),
            actionNumber: 1,
            actionType: ActionType.CATCH,
            displayMessage: 'First Last throws to Last First',
            comments: [],
            tags: ['good', 'huck'],
        }

        await saveRedisAction(client, actionData)

        const baseKey = getActionBaseKey(actionData.pointId.toString(), actionData.actionNumber)
        const totalKeys = await client.keys('*')
        expect(totalKeys.length).toBe(6)

        const team = await client.hGetAll(`${baseKey}:team`)
        expect(team.id).toBe(actionData.team._id?.toString())
        expect(team.place).toBe(actionData.team.place)
        expect(team.name).toBe(actionData.team.name)
        expect(team.teamname).toBe(actionData.team.teamname)
        expect(team.seasonStart).toBe(actionData.team.seasonStart?.getUTCFullYear().toString())
        expect(team.seasonEnd).toBe(actionData.team.seasonEnd?.getUTCFullYear().toString())

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

        const display = await client.get(`${baseKey}:display`)
        expect(display).toBe(actionData.displayMessage)

        const tagLength = await client.lLen(`${baseKey}:tags`)
        const tags = await client.lRange(`${baseKey}:tags`, 0, tagLength)
        expect(tags.length).toBe(2)
        expect(tags[0]).toBe(actionData.tags[0])
        expect(tags[1]).toBe(actionData.tags[1])
    })

    it('without players', async () => {
        const actionData: IAction = {
            _id: new Types.ObjectId(),
            team: {
                _id: new Types.ObjectId(),
                place: 'San Francisco',
                name: 'Sockeye',
                teamname: 'sfsockeye',
                seasonStart: new Date(2022),
                seasonEnd: new Date(2022),
            },
            pointId: new Types.ObjectId(),
            actionNumber: 1,
            actionType: ActionType.TIMEOUT,
            displayMessage: 'A timeout is called',
            comments: [],
            tags: ['veteran call'],
        }

        await saveRedisAction(client, actionData)

        const baseKey = getActionBaseKey(actionData.pointId.toString(), actionData.actionNumber)
        const totalKeys = await client.keys('*')
        expect(totalKeys.length).toBe(4)

        const team = await client.hGetAll(`${baseKey}:team`)
        expect(team.id).toBe(actionData.team._id?.toString())
        expect(team.place).toBe(actionData.team.place)
        expect(team.name).toBe(actionData.team.name)
        expect(team.teamname).toBe(actionData.team.teamname)
        expect(team.seasonStart).toBe(actionData.team.seasonStart?.getUTCFullYear().toString())
        expect(team.seasonEnd).toBe(actionData.team.seasonEnd?.getUTCFullYear().toString())

        const playerOne = await client.hGetAll(`${baseKey}:playerone`)
        expect(playerOne).toMatchObject({})

        const playerTwo = await client.hGetAll(`${baseKey}:playertwo`)
        expect(playerTwo).toMatchObject({})

        const type = await client.get(`${baseKey}:type`)
        expect(type).toBe(actionData.actionType)

        const display = await client.get(`${baseKey}:display`)
        expect(display).toBe(actionData.displayMessage)

        const tagLength = await client.lLen(`${baseKey}:tags`)
        const tags = await client.lRange(`${baseKey}:tags`, 0, tagLength)
        expect(tags.length).toBe(1)
        expect(tags[0]).toBe(actionData.tags[0])
    })

    it('with minimal data', async () => {
        const actionData: IAction = {
            _id: new Types.ObjectId(),
            team: {
                name: 'Sockeye',
            },
            playerOne: {
                firstName: 'First',
                lastName: 'Last',
            },
            playerTwo: {
                firstName: 'Last',
                lastName: 'First',
            },
            pointId: new Types.ObjectId(),
            actionNumber: 1,
            actionType: ActionType.CATCH,
            displayMessage: 'First Last throws to Last First',
            comments: [],
            tags: ['good', 'huck'],
        }

        await saveRedisAction(client, actionData)

        const baseKey = getActionBaseKey(actionData.pointId.toString(), actionData.actionNumber)
        const totalKeys = await client.keys('*')
        expect(totalKeys.length).toBe(6)

        const team = await client.hGetAll(`${baseKey}:team`)
        expect(team.id).toBeUndefined()
        expect(team.place).toBeUndefined()
        expect(team.name).toBe(actionData.team.name)
        expect(team.teamname).toBeUndefined()
        expect(team.seasonStart).toBeUndefined()
        expect(team.seasonEnd).toBeUndefined()

        const playerOne = await client.hGetAll(`${baseKey}:playerone`)
        expect(playerOne.id).toBeUndefined()
        expect(playerOne.firstName).toBe(actionData.playerOne?.firstName)
        expect(playerOne.lastName).toBe(actionData.playerOne?.lastName)
        expect(playerOne.username).toBeUndefined()

        const playerTwo = await client.hGetAll(`${baseKey}:playertwo`)
        expect(playerTwo.id).toBeUndefined()
        expect(playerTwo.firstName).toBe(actionData.playerTwo?.firstName)
        expect(playerTwo.lastName).toBe(actionData.playerTwo?.lastName)
        expect(playerTwo.username).toBeUndefined()

        const type = await client.get(`${baseKey}:type`)
        expect(type).toBe(actionData.actionType)

        const display = await client.get(`${baseKey}:display`)
        expect(display).toBe(actionData.displayMessage)

        const tagLength = await client.lLen(`${baseKey}:tags`)
        const tags = await client.lRange(`${baseKey}:tags`, 0, tagLength)
        expect(tags.length).toBe(2)
        expect(tags[0]).toBe(actionData.tags[0])
        expect(tags[1]).toBe(actionData.tags[1])
    })
})

describe('test get redis action', () => {
    it('with all data', async () => {
        const actionData: IAction = {
            _id: new Types.ObjectId(),
            team: {
                _id: new Types.ObjectId(),
                place: 'San Francisco',
                name: 'Sockeye',
                teamname: 'sfsockeye',
                seasonStart: new Date('2022'),
                seasonEnd: new Date('2022'),
            },
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
            pointId: new Types.ObjectId(),
            actionNumber: 1,
            actionType: ActionType.CATCH,
            displayMessage: 'First Last throws to Last First',
            comments: [],
            tags: ['good', 'huck'],
        }

        const baseKey = getActionBaseKey(actionData.pointId.toString(), actionData.actionNumber)
        await client.hSet(`${baseKey}:team`, 'name', actionData.team.name)
        await client.hSet(`${baseKey}:team`, 'id', actionData.team._id!.toString())
        await client.hSet(`${baseKey}:team`, 'place', actionData.team.place!)
        await client.hSet(`${baseKey}:team`, 'teamname', actionData.team.teamname!)
        await client.hSet(`${baseKey}:team`, 'seasonStart', actionData.team.seasonStart!.getUTCFullYear())
        await client.hSet(`${baseKey}:team`, 'seasonEnd', actionData.team.seasonEnd!.getUTCFullYear())
        await client.set(`${baseKey}:type`, actionData.actionType)
        await client.set(`${baseKey}:display`, actionData.displayMessage)
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

        const action = await getRedisAction(client, actionData.pointId.toString(), actionData.actionNumber)
        expect(action._id).toBeUndefined()
        expect(action.pointId.toString()).toBe(actionData.pointId.toString())
        expect(action.actionType).toBe(actionData.actionType)
        expect(action.actionNumber).toBe(actionData.actionNumber)
        expect(action.displayMessage).toBe(actionData.displayMessage)
        expect(action.playerOne?._id?.toString()).toBe(actionData.playerOne?._id?.toString())
        expect(action.playerOne?.firstName).toBe(actionData.playerOne?.firstName)
        expect(action.playerOne?.lastName).toBe(actionData.playerOne?.lastName)
        expect(action.playerOne?.username).toBe(actionData.playerOne?.username)
        expect(action.playerTwo?._id?.toString()).toBe(actionData.playerTwo?._id?.toString())
        expect(action.playerTwo?.firstName).toBe(actionData.playerTwo?.firstName)
        expect(action.playerTwo?.lastName).toBe(actionData.playerTwo?.lastName)
        expect(action.playerTwo?.username).toBe(actionData.playerTwo?.username)
        expect(action.team._id?.toString()).toBe(actionData.team._id?.toString())
        expect(action.team.name).toBe(actionData.team.name)
        expect(action.team.place).toBe(actionData.team.place)
        expect(action.team.teamname).toBe(actionData.team.teamname)
        expect(action.team.seasonStart?.getUTCFullYear()).toBe(actionData.team.seasonStart?.getUTCFullYear())
        expect(action.team.seasonEnd?.getUTCFullYear()).toBe(actionData.team.seasonEnd?.getUTCFullYear())
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
        const actionData: IAction = {
            _id: new Types.ObjectId(),
            team: {
                _id: new Types.ObjectId(),
                place: 'San Francisco',
                name: 'Sockeye',
                teamname: 'sfsockeye',
                seasonStart: new Date('2022'),
                seasonEnd: new Date('2022'),
            },
            pointId: new Types.ObjectId(),
            actionNumber: 1,
            actionType: ActionType.CATCH,
            displayMessage: 'First Last throws to Last First',
            comments: [],
            tags: ['good', 'huck'],
        }

        const baseKey = getActionBaseKey(actionData.pointId.toString(), actionData.actionNumber)
        await client.hSet(`${baseKey}:team`, 'name', actionData.team.name)
        await client.hSet(`${baseKey}:team`, 'id', actionData.team._id!.toString())
        await client.hSet(`${baseKey}:team`, 'place', actionData.team.place!)
        await client.hSet(`${baseKey}:team`, 'teamname', actionData.team.teamname!)
        await client.hSet(`${baseKey}:team`, 'seasonStart', actionData.team.seasonStart!.getUTCFullYear())
        await client.hSet(`${baseKey}:team`, 'seasonEnd', actionData.team.seasonEnd!.getUTCFullYear())
        await client.set(`${baseKey}:type`, actionData.actionType)
        await client.set(`${baseKey}:display`, actionData.displayMessage)
        for (const tag of actionData.tags) {
            await client.rPush(`${baseKey}:tags`, tag)
        }

        const action = await getRedisAction(client, actionData.pointId.toString(), actionData.actionNumber)
        expect(action._id).toBeUndefined()
        expect(action.pointId.toString()).toBe(actionData.pointId.toString())
        expect(action.actionType).toBe(actionData.actionType)
        expect(action.actionNumber).toBe(actionData.actionNumber)
        expect(action.displayMessage).toBe(actionData.displayMessage)
        expect(action.playerOne).toBeUndefined()
        expect(action.playerTwo).toBeUndefined()
        expect(action.team._id?.toString()).toBe(actionData.team._id?.toString())
        expect(action.team.name).toBe(actionData.team.name)
        expect(action.team.place).toBe(actionData.team.place)
        expect(action.team.teamname).toBe(actionData.team.teamname)
        expect(action.team.seasonStart?.getUTCFullYear()).toBe(actionData.team.seasonStart?.getUTCFullYear())
        expect(action.team.seasonEnd?.getUTCFullYear()).toBe(actionData.team.seasonEnd?.getUTCFullYear())
        expect(action.tags.length).toBe(actionData.tags.length)
        expect(action.tags[0]).toBe(actionData.tags[0])
        expect(action.tags[1]).toBe(actionData.tags[1])
        expect(action.comments.length).toBe(0)
    })

    it('with minimal data', async () => {
        const actionData: IAction = {
            _id: new Types.ObjectId(),
            team: {
                name: 'Sockeye',
            },
            playerOne: {
                firstName: 'First',
                lastName: 'Last',
            },
            playerTwo: {
                firstName: 'Last',
                lastName: 'First',
            },
            pointId: new Types.ObjectId(),
            actionNumber: 1,
            actionType: ActionType.CATCH,
            displayMessage: 'First Last throws to Last First',
            comments: [],
            tags: ['good', 'huck'],
        }

        const baseKey = getActionBaseKey(actionData.pointId.toString(), actionData.actionNumber)
        await client.hSet(`${baseKey}:team`, 'name', actionData.team.name)
        await client.set(`${baseKey}:type`, actionData.actionType)
        await client.set(`${baseKey}:display`, actionData.displayMessage)
        await client.hSet(`${baseKey}:playerone`, 'firstName', actionData.playerOne!.firstName)
        await client.hSet(`${baseKey}:playerone`, 'lastName', actionData.playerOne!.lastName)
        await client.hSet(`${baseKey}:playertwo`, 'firstName', actionData.playerTwo!.firstName)
        await client.hSet(`${baseKey}:playertwo`, 'lastName', actionData.playerTwo!.lastName)
        for (const tag of actionData.tags) {
            await client.rPush(`${baseKey}:tags`, tag)
        }

        const action = await getRedisAction(client, actionData.pointId.toString(), actionData.actionNumber)
        expect(action._id).toBeUndefined()
        expect(action.pointId.toString()).toBe(actionData.pointId.toString())
        expect(action.actionType).toBe(actionData.actionType)
        expect(action.actionNumber).toBe(actionData.actionNumber)
        expect(action.displayMessage).toBe(actionData.displayMessage)
        expect(action.playerOne?._id).toBeUndefined()
        expect(action.playerOne?.firstName).toBe(actionData.playerOne?.firstName)
        expect(action.playerOne?.lastName).toBe(actionData.playerOne?.lastName)
        expect(action.playerOne?.username).toBeUndefined()
        expect(action.playerTwo?._id).toBeUndefined()
        expect(action.playerTwo?.firstName).toBe(actionData.playerTwo?.firstName)
        expect(action.playerTwo?.lastName).toBe(actionData.playerTwo?.lastName)
        expect(action.playerTwo?.username).toBeUndefined()
        expect(action.team._id).toBeUndefined()
        expect(action.team.name).toBe(actionData.team.name)
        expect(action.team.place).toBeUndefined()
        expect(action.team.teamname).toBeUndefined()
        expect(action.team.seasonStart).toBeUndefined()
        expect(action.team.seasonEnd).toBeUndefined()
        expect(action.tags.length).toBe(actionData.tags.length)
        expect(action.tags[0]).toBe(actionData.tags[0])
        expect(action.tags[1]).toBe(actionData.tags[1])
        expect(action.comments.length).toBe(0)
    })
})

describe('test delete redis action', () => {
    it('delete all data', async () => {
        const actionData: IAction = {
            _id: new Types.ObjectId(),
            team: {
                _id: new Types.ObjectId(),
                place: 'San Francisco',
                name: 'Sockeye',
                teamname: 'sfsockeye',
                seasonStart: new Date('2022'),
                seasonEnd: new Date('2022'),
            },
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
            pointId: new Types.ObjectId(),
            actionNumber: 1,
            actionType: ActionType.CATCH,
            displayMessage: 'First Last throws to Last First',
            comments: [],
            tags: ['good', 'huck'],
        }

        const baseKey = getActionBaseKey(actionData.pointId.toString(), actionData.actionNumber)
        await client.hSet(`${baseKey}:team`, 'name', actionData.team.name)
        await client.hSet(`${baseKey}:team`, 'id', actionData.team._id!.toString())
        await client.hSet(`${baseKey}:team`, 'place', actionData.team.place!)
        await client.hSet(`${baseKey}:team`, 'teamname', actionData.team.teamname!)
        await client.hSet(`${baseKey}:team`, 'seasonStart', actionData.team.seasonStart!.getUTCFullYear())
        await client.hSet(`${baseKey}:team`, 'seasonEnd', actionData.team.seasonEnd!.getUTCFullYear())
        await client.set(`${baseKey}:type`, actionData.actionType)
        await client.set(`${baseKey}:display`, actionData.displayMessage)
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

        await deleteRedisAction(client, actionData.pointId.toString(), actionData.actionNumber)
        const team = await client.hGetAll(`${baseKey}:team`)
        const type = await client.get(`${baseKey}:type`)
        const display = await client.get(`${baseKey}:display`)
        const playerOne = await client.hGetAll(`${baseKey}:playerone`)
        const playerTwo = await client.hGetAll(`${baseKey}:playertwo`)
        expect(team).toMatchObject({})
        expect(type).toBeNull()
        expect(display).toBeNull()
        expect(playerOne).toMatchObject({})
        expect(playerTwo).toMatchObject({})
    })

    it('with no previously existing data', async () => {
        const actionData: IAction = {
            _id: new Types.ObjectId(),
            team: {
                _id: new Types.ObjectId(),
                place: 'San Francisco',
                name: 'Sockeye',
                teamname: 'sfsockeye',
                seasonStart: new Date('2022'),
                seasonEnd: new Date('2022'),
            },
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
            pointId: new Types.ObjectId(),
            actionNumber: 1,
            actionType: ActionType.CATCH,
            displayMessage: 'First Last throws to Last First',
            comments: [],
            tags: ['good', 'huck'],
        }
        await deleteRedisAction(client, actionData.pointId.toString(), actionData.actionNumber)

        const baseKey = getActionBaseKey(actionData.pointId.toString(), actionData.actionNumber)
        const team = await client.hGetAll(`${baseKey}:team`)
        const type = await client.get(`${baseKey}:type`)
        const display = await client.get(`${baseKey}:display`)
        const playerOne = await client.hGetAll(`${baseKey}:playerone`)
        const playerTwo = await client.hGetAll(`${baseKey}:playertwo`)
        expect(team).toMatchObject({})
        expect(type).toBeNull()
        expect(display).toBeNull()
        expect(playerOne).toMatchObject({})
        expect(playerTwo).toMatchObject({})
    })
})

describe('test save redis comment', () => {
    it('with all data', async () => {
        const commentData: Comment = {
            comment: 'That was a wild huck',
            user: { _id: new Types.ObjectId(), firstName: 'Noah', lastName: 'Celuch', username: 'noah' },
        }
        await saveRedisComment(client, 'point1', 1, commentData)
        const key = getActionBaseKey('point1', 1)

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
            user: { firstName: 'Noah', lastName: 'Celuch' },
        }
        await saveRedisComment(client, 'point1', 1, commentData)
        const key = getActionBaseKey('point1', 1)

        const totalComments = await client.get(`${key}:comments`)
        const comment = await client.get(`${key}:comments:1:text`)
        const user = await client.hGetAll(`${key}:comments:1:user`)
        expect(totalComments).toBe('1')
        expect(comment).toBe(commentData.comment)
        expect(user.id).toBeUndefined()
        expect(user.firstName).toBe(commentData.user.firstName)
        expect(user.lastName).toBe(commentData.user.lastName)
        expect(user.username).toBeUndefined()
    })
})

describe('test delete redis comment', () => {
    it('with existing comment', async () => {
        const data: Comment = {
            comment: 'That was a wild huck',
            user: { _id: new Types.ObjectId(), username: 'noah', firstName: 'Noah', lastName: 'Celuch' },
        }
        const pointId = 'point1'
        const actionNumber = 1
        const baseKey = getActionBaseKey(pointId, actionNumber)
        const totalComments = await client.incr(`${baseKey}:comments`)
        await client.set(`${baseKey}:comments:${totalComments}:text`, data.comment)
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'id', data.user._id?.toString() || '')
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'username', data.user.username || '')
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'firstName', data.user.firstName)
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'lastName', data.user.lastName)

        await deleteRedisComment(client, 'point1', 1, 1)

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
        const baseKey = getActionBaseKey(pointId, actionNumber)
        const totalComments = 0
        await deleteRedisComment(client, 'point1', 1, 1)

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
        }
        const pointId = 'point1'
        const actionNumber = 1
        const baseKey = getActionBaseKey(pointId, actionNumber)
        const totalComments = await client.incr(`${baseKey}:comments`)
        await client.set(`${baseKey}:comments:${totalComments}:text`, data.comment)
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'id', data.user._id?.toString() || '')
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'username', data.user.username || '')
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'firstName', data.user.firstName)
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'lastName', data.user.lastName)

        const comment = await getRedisComment(client, 'point1', 1, 1)
        expect(comment?.comment).toBe(data.comment)
        expect(comment?.user).toMatchObject(data.user)
    })

    it('with non-existent text', async () => {
        const data: Comment = {
            comment: 'That was a wild huck',
            user: { _id: new Types.ObjectId(), username: 'noah', firstName: 'Noah', lastName: 'Celuch' },
        }
        const pointId = 'point1'
        const actionNumber = 1
        const baseKey = getActionBaseKey(pointId, actionNumber)
        const totalComments = await client.incr(`${baseKey}:comments`)
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'id', data.user._id?.toString() || '')
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'username', data.user.username || '')
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'firstName', data.user.firstName)
        await client.hSet(`${baseKey}:comments:${totalComments}:user`, 'lastName', data.user.lastName)

        const comment = await getRedisComment(client, 'point1', 1, 1)
        expect(comment).toBeUndefined()
    })

    it('with non-existent user', async () => {
        const data: Comment = {
            comment: 'That was a wild huck',
            user: { _id: new Types.ObjectId(), username: 'noah', firstName: 'Noah', lastName: 'Celuch' },
        }
        const pointId = 'point1'
        const actionNumber = 1
        const baseKey = getActionBaseKey(pointId, actionNumber)
        const totalComments = await client.incr(`${baseKey}:comments`)
        await client.set(`${baseKey}:comments:${totalComments}:text`, data.comment)

        const comment = await getRedisComment(client, 'point1', 1, 1)
        expect(comment).toBeUndefined()
    })
})

describe('test action exists', () => {
    it('with existing action', async () => {
        const key = getActionBaseKey('point1', 2)
        await client.set(`${key}:type`, 'SCORE')
        const exists = await actionExists(client, 'point1', 2)
        expect(exists).toBe(true)
    })

    it('with non-existing action', async () => {
        const exists = await actionExists(client, 'point1', 2)
        expect(exists).toBe(false)
    })
})
