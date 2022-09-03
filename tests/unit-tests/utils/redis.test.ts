/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Types } from 'mongoose'
import IAction, { ActionType } from '../../../src/types/action'
import { saveRedisAction, getRedisAction } from '../../../src/utils/redis'
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
        expect(action.comments.length).toBe(0)
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
