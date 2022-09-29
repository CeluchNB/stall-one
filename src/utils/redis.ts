import IAction, { RedisClientType, ActionType, Comment } from '../types/action'
import { getActionBaseKey, parseRedisUser } from './utils'
import { Types } from 'mongoose'
import { Player, Team, TeamNumberString } from '../types/ultmt'
import { createClient } from 'redis'

const client = createClient({ url: process.env.REDIS_URL })
export const getClient = async () => {
    if (!client.isOpen) {
        await client.connect()
    }
    return client
}

export const saveRedisAction = async (
    redisClient: RedisClientType,
    data: IAction,
    pointId: string,
    teamNumber: TeamNumberString,
) => {
    const { actionNumber: number, team, playerOne, playerTwo, displayMessage, tags, actionType } = data
    const { _id, place, name, teamname, seasonStart, seasonEnd } = team
    const baseKey = getActionBaseKey(pointId, number, teamNumber)

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
        await redisClient.hSet(`${baseKey}:team`, 'seasonStart', new Date(seasonStart).getUTCFullYear())
    }
    if (seasonEnd) {
        await redisClient.hSet(`${baseKey}:team`, 'seasonEnd', new Date(seasonEnd).getUTCFullYear())
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
    teamNumber: TeamNumberString,
): Promise<IAction> => {
    const baseKey = getActionBaseKey(pointId, number, teamNumber)
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
    const totalComments = await redisClient.get(`${baseKey}:comments`)
    const comments: Comment[] = []

    for (let i = 1; i <= Number(totalComments); i++) {
        const comment = await redisClient.get(`${baseKey}:comments:${i}:text`)
        const commentor = await redisClient.hGetAll(`${baseKey}:comments:${i}:user`)
        const user = parseRedisUser(commentor) as Player
        if (comment) {
            comments.push({ comment, user })
        }
    }

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
        team,
        actionNumber: number,
        actionType: actionType as ActionType,
        displayMessage,
        tags,
        comments,
    }

    action.playerOne = parseRedisUser(playerOne)
    action.playerTwo = parseRedisUser(playerTwo)

    return action
}

export const deleteRedisAction = async (
    redisClient: RedisClientType,
    pointId: string,
    number: number,
    teamNumber: TeamNumberString,
) => {
    const baseKey = getActionBaseKey(pointId, number, teamNumber)
    await redisClient.del(`${baseKey}:team`)
    await redisClient.del(`${baseKey}:type`)
    await redisClient.del(`${baseKey}:display`)
    await redisClient.del(`${baseKey}:playerone`)
    await redisClient.del(`${baseKey}:playertwo`)
    await redisClient.del(`${baseKey}:tags`)
    await redisClient.del(`${baseKey}:comments`)
}

export const saveRedisComment = async (
    redisClient: RedisClientType,
    pointId: string,
    actionNumber: number,
    data: Comment,
    teamNumber: TeamNumberString,
) => {
    const baseKey = getActionBaseKey(pointId, actionNumber, teamNumber)
    const totalComments = await redisClient.incr(`${baseKey}:comments`)
    await redisClient.set(`${baseKey}:comments:${totalComments}:text`, data.comment)
    if (data.user._id) {
        await redisClient.hSet(`${baseKey}:comments:${totalComments}:user`, 'id', data.user._id.toString())
    }
    if (data.user.username) {
        await redisClient.hSet(`${baseKey}:comments:${totalComments}:user`, 'username', data.user.username)
    }
    await redisClient.hSet(`${baseKey}:comments:${totalComments}:user`, 'firstName', data.user.firstName)
    await redisClient.hSet(`${baseKey}:comments:${totalComments}:user`, 'lastName', data.user.lastName)
}

export const getRedisComment = async (
    redisClient: RedisClientType,
    pointId: string,
    actionNumber: number,
    commentNumber: number,
    teamNumber: TeamNumberString,
): Promise<Comment | undefined> => {
    const baseKey = getActionBaseKey(pointId, actionNumber, teamNumber)
    const comment = await redisClient.get(`${baseKey}:comments:${commentNumber}:text`)
    const userData = await redisClient.hGetAll(`${baseKey}:comments:${commentNumber}:user`)
    const user = parseRedisUser(userData)

    if (!comment || !user) {
        return undefined
    }
    return { user, comment }
}

export const deleteRedisComment = async (
    redisClient: RedisClientType,
    pointId: string,
    actionNumber: number,
    commentNumber: number,
    teamNumber: TeamNumberString,
) => {
    const baseKey = getActionBaseKey(pointId, actionNumber, teamNumber)
    await redisClient.del(`${baseKey}:comments:${commentNumber}:text`)
    await redisClient.del(`${baseKey}:comments:${commentNumber}:user`)
}

export const actionExists = async (
    redisClient: RedisClientType,
    pointId: string,
    actionNumber: number,
    teamNumber: TeamNumberString,
): Promise<boolean> => {
    const baseKey = getActionBaseKey(pointId, actionNumber, teamNumber)
    const type = await redisClient.get(`${baseKey}:type`)
    return !!type
}
