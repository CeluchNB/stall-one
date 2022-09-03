import IAction, { RedisClientType, ActionType } from '../types/action'
import { getActionBaseKey } from './utils'
import { Types } from 'mongoose'
import { Player, Team } from '../types/ultmt'

export const saveRedisAction = async (redisClient: RedisClientType, data: IAction) => {
    const { pointId, actionNumber: number, team, playerOne, playerTwo, displayMessage, tags, actionType } = data
    const { _id, place, name, teamname, seasonStart, seasonEnd } = team
    const baseKey = getActionBaseKey(pointId.toString(), number)

    await redisClient.hSet(`${baseKey}:team`, 'name', name)
    if (_id) {
        await redisClient.hSet(`${baseKey}:team`, 'id', _id?.toString())
    }
    if (place) {
        await redisClient.hSet(`${baseKey}:team`, 'place', place)
    }
    if (teamname) {
        await redisClient.hSet(`${baseKey}:team`, 'teamname', teamname)
    }
    if (seasonStart) {
        await redisClient.hSet(`${baseKey}:team`, 'seasonStart', seasonStart.getUTCFullYear())
    }
    if (seasonEnd) {
        await redisClient.hSet(`${baseKey}:team`, 'seasonEnd', seasonEnd.getUTCFullYear())
    }

    await redisClient.set(`${baseKey}:type`, actionType)
    await redisClient.set(`${baseKey}:display`, displayMessage)
    if (playerOne) {
        if (playerOne._id) {
            await redisClient.hSet(`${baseKey}:playerone`, 'id', playerOne._id.toString())
        }
        await redisClient.hSet(`${baseKey}:playerone`, 'firstName', playerOne.firstName)
        await redisClient.hSet(`${baseKey}:playerone`, 'lastName', playerOne.lastName)
        if (playerOne.username) {
            await redisClient.hSet(`${baseKey}:playerone`, 'username', playerOne.username)
        }
    }
    if (playerTwo) {
        if (playerTwo._id) {
            await redisClient.hSet(`${baseKey}:playertwo`, 'id', playerTwo._id.toString())
        }
        await redisClient.hSet(`${baseKey}:playertwo`, 'firstName', playerTwo.firstName)
        await redisClient.hSet(`${baseKey}:playertwo`, 'lastName', playerTwo.lastName)
        if (playerTwo.username) {
            await redisClient.hSet(`${baseKey}:playertwo`, 'username', playerTwo.username)
        }
    }
    for (const tag of tags) {
        await redisClient.rPush(`${baseKey}:tags`, tag)
    }
}

export const getRedisAction = async (
    redisClient: RedisClientType,
    pointId: string,
    number: number,
): Promise<IAction> => {
    const baseKey = getActionBaseKey(pointId, number)
    const teamId = await redisClient.hGet(`${baseKey}:team`, 'id')
    const teamPlace = await redisClient.hGet(`${baseKey}:team`, 'place')
    const teamName = (await redisClient.hGet(`${baseKey}:team`, 'name')) as string
    const teamTeamname = await redisClient.hGet(`${baseKey}:team`, 'teamname')
    const teamStart = await redisClient.hGet(`${baseKey}:team`, 'seasonStart')
    const teamEnd = await redisClient.hGet(`${baseKey}:team`, 'seasonEnd')
    const actionType = await redisClient.get(`${baseKey}:type`)
    const displayMessage = (await redisClient.get(`${baseKey}:display`)) as string
    const playerOne = await redisClient.hGetAll(`${baseKey}:playerone`)
    const playerTwo = await redisClient.hGetAll(`${baseKey}:playertwo`)
    const tags = await redisClient.lRange(`${baseKey}:tags`, 0, -1)

    const team: Team = {
        name: teamName,
    }

    if (teamId) {
        team._id = new Types.ObjectId(teamId)
    }

    if (teamPlace) {
        team.place = teamPlace
    }

    if (teamTeamname) {
        team.teamname = teamTeamname
    }

    if (teamStart) {
        team.seasonStart = new Date(teamStart)
    }
    if (teamEnd) {
        team.seasonEnd = new Date(teamEnd)
    }

    const action: IAction = {
        pointId: new Types.ObjectId(pointId),
        team,
        actionNumber: number,
        actionType: actionType as ActionType,
        displayMessage,
        tags,
        comments: [],
    }

    if (Object.keys(playerOne).length > 0) {
        const { id, firstName, lastName, username } = playerOne
        const player: Player = {
            firstName: firstName,
            lastName: lastName,
        }
        if (id) {
            player._id = new Types.ObjectId(id)
        }
        if (username) {
            player.username = username
        }

        action.playerOne = player
    }

    if (Object.keys(playerTwo).length > 0) {
        const { id, firstName, lastName, username } = playerTwo
        const player: Player = {
            firstName: firstName,
            lastName: lastName,
        }
        if (id) {
            player._id = new Types.ObjectId(id)
        }
        if (username) {
            player.username = username
        }

        action.playerTwo = player
    }

    return action
}
