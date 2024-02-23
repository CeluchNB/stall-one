import * as Constants from '../../../src/utils/constants'
import axios from 'axios'
import { getTeam, getUser, authenticateManager, createGuest } from '../../../src/utils/ultmt'
import { Types } from 'mongoose'
import { ApiError } from '../../../src/types/errors'

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

const teamData = {
    _id: new Types.ObjectId(),
    place: 'Place 1',
    name: 'Name 1',
    teamname: 'teamname1',
    players: [{ _id: new Types.ObjectId(), firstName: 'First', lastName: 'Last', username: 'firstlast' }],
}

describe('test get user', () => {
    it('with successful response', async () => {
        jest.spyOn(axios, 'get').mockReturnValueOnce(Promise.resolve({ data: { user: userData }, status: 200 }))
        const user = await getUser('', '', 'jwt')
        expect(user._id.toString()).toBe(userData._id.toString())
        expect(user.firstName).toBe(userData.firstName)
        expect(user.lastName).toBe(userData.lastName)
        expect(user.username).toBe(userData.username)
    })

    it('with resolved unsuccessful response', async () => {
        jest.spyOn(axios, 'get').mockReturnValueOnce(Promise.resolve({ data: {}, status: 401 }))
        await expect(getUser('', '', 'jwt')).rejects.toThrowError(new ApiError(Constants.UNAUTHENTICATED_USER, 401))
    })

    it('with rejected unsuccessful response', async () => {
        jest.spyOn(axios, 'get').mockReturnValueOnce(Promise.reject({ data: {}, status: 401 }))
        await expect(getUser('', '', 'jwt')).rejects.toThrowError(new ApiError(Constants.UNAUTHENTICATED_USER, 401))
    })
})

describe('test authenticate manager', () => {
    it('with successful response', async () => {
        jest.spyOn(axios, 'get').mockReturnValueOnce(Promise.resolve({ data: { user: userData }, status: 200 }))
        const user = await authenticateManager('', '', 'jwt', 'teamid')
        expect(user._id.toString()).toBe(userData._id.toString())
        expect(user.firstName).toBe(userData.firstName)
        expect(user.lastName).toBe(userData.lastName)
        expect(user.username).toBe(userData.username)
    })

    it('with resolved unsuccessful response', async () => {
        jest.spyOn(axios, 'get').mockReturnValueOnce(Promise.resolve({ data: {}, status: 401 }))
        await expect(authenticateManager('', '', 'jwt', 'teamid')).rejects.toThrowError(
            new ApiError(Constants.UNAUTHENTICATED_USER, 401),
        )
    })

    it('with rejected unsuccessful response', async () => {
        jest.spyOn(axios, 'get').mockReturnValueOnce(Promise.reject({ data: {}, status: 401 }))
        await expect(authenticateManager('', '', 'jwt', 'teamid')).rejects.toThrowError(
            new ApiError(Constants.UNAUTHENTICATED_USER, 401),
        )
    })

    it('with missing jwt', async () => {
        await expect(authenticateManager('', '', undefined, 'teamid')).rejects.toThrowError(
            new ApiError(Constants.UNAUTHENTICATED_USER, 401),
        )
    })

    it('with missing teamid', async () => {
        await expect(authenticateManager('', '', 'jwt', undefined)).rejects.toThrowError(
            new ApiError(Constants.UNAUTHENTICATED_USER, 401),
        )
    })
})

describe('test get team', () => {
    it('with valid response', async () => {
        jest.spyOn(axios, 'get').mockReturnValueOnce(Promise.resolve({ data: { team: teamData }, status: 200 }))
        const team = await getTeam('', '', 'teamid')
        expect(team._id.toString()).toBe(teamData._id.toString())
        expect(team.name).toBe(teamData.name)
        expect(team.place).toBe(teamData.place)
        expect(team.players.length).toBe(1)
    })

    it('with resolved unsuccessful response', async () => {
        jest.spyOn(axios, 'get').mockReturnValueOnce(Promise.resolve({ data: {}, status: 400 }))
        await expect(getTeam('', '', 'teamid')).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 404))
    })

    it('with rejected unsuccessful response', async () => {
        jest.spyOn(axios, 'get').mockReturnValueOnce(Promise.reject({ data: {}, status: 400 }))
        await expect(getTeam('', '', 'teamid')).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 404))
    })

    it('with missing teamid', async () => {
        await expect(getTeam('', '', undefined)).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 404))
    })
})

describe('test create guest', () => {
    it('with valid response', async () => {
        jest.spyOn(axios, 'post').mockReturnValueOnce(Promise.resolve({ data: { team: teamData }, status: 200 }))
        const team = await createGuest('', '', { firstName: 'First', lastName: 'last' }, 'jwt', 'teamid')
        expect(team._id.toString()).toBe(teamData._id.toString())
        expect(team.name).toBe(teamData.name)
        expect(team.place).toBe(teamData.place)
        expect(team.players.length).toBe(1)
    })

    it('with rejected unsuccessful response', async () => {
        jest.spyOn(axios, 'post').mockReturnValueOnce(Promise.reject({ data: {}, status: 400 }))
        await expect(
            createGuest('', '', { firstName: 'First', lastName: 'last' }, 'jwt', 'teamid'),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_ADD_PLAYER, 404))
    })

    it('with missing jwt', async () => {
        await expect(createGuest('', '', { firstName: 'First', lastName: 'last' })).rejects.toThrowError(
            new ApiError(Constants.UNAUTHENTICATED_USER, 404),
        )
    })

    it('with missing teamid', async () => {
        await expect(createGuest('', '', { firstName: 'First', lastName: 'last' }, 'jwt')).rejects.toThrowError(
            new ApiError(Constants.UNAUTHENTICATED_USER, 404),
        )
    })
})
