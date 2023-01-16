import { RedisClientType, ActionType, Comment, RedisAction } from '../types/action'
import { getActionBaseKey, parseRedisUser } from './utils'
import { Player, TeamNumberString } from '../types/ultmt'
import { createClient } from 'redis'

const client = createClient({ url: process.env.REDIS_URL })
export const getClient = async () => {
    if (!client.isOpen) {
        await client.connect()
    }
    return client
}

export const saveRedisAction = async (redisClient: RedisClientType, data: RedisAction, pointId: string) => {
    const { actionNumber: number, teamNumber, playerOne, playerTwo, tags, actionType } = data
    const baseKey = getActionBaseKey(pointId, number, teamNumber)

    await redisClient.set(`${baseKey}:type`, actionType)
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
    actionNumber: number,
    teamNumber: TeamNumberString,
): Promise<RedisAction> => {
    const baseKey = getActionBaseKey(pointId, actionNumber, teamNumber)
    const actionType = await redisClient.get(`${baseKey}:type`)
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
            comments.push({ comment, user, commentNumber: i })
        }
    }

    const action: RedisAction = {
        teamNumber,
        actionNumber,
        actionType: actionType as ActionType,
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
    await redisClient.del(`${baseKey}:type`)
    await redisClient.del(`${baseKey}:playerone`)
    await redisClient.del(`${baseKey}:playertwo`)
    await redisClient.del(`${baseKey}:tags`)
    await redisClient.del(`${baseKey}:comments`)
}

export const saveRedisComment = async (
    redisClient: RedisClientType,
    pointId: string,
    actionNumber: number,
    data: { user: Player; comment: string },
    teamNumber: TeamNumberString,
) => {
    const baseKey = getActionBaseKey(pointId, actionNumber, teamNumber)
    const totalComments = await redisClient.incr(`${baseKey}:comments`)
    await redisClient.set(`${baseKey}:comments:${totalComments}:text`, data.comment)
    await redisClient.hSet(`${baseKey}:comments:${totalComments}:user`, 'id', data.user._id.toString())
    await redisClient.hSet(`${baseKey}:comments:${totalComments}:user`, 'username', data.user.username)
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
    return { user, comment, commentNumber }
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

export const getLastRedisAction = async (
    redisClient: RedisClientType,
    gameId: string,
    pointId: string,
    team: TeamNumberString,
): Promise<RedisAction | undefined> => {
    const totalActions = await redisClient.get(`${gameId}:${pointId}:${team}:actions`)
    if (!totalActions) {
        return undefined
    }

    const prevActionExists = await actionExists(redisClient, pointId, Number(totalActions), team)
    if (!prevActionExists) {
        return undefined
    }

    return await getRedisAction(redisClient, pointId, Number(totalActions), team)
}

export const isPullingTeam = async (
    redisClient: RedisClientType,
    gameId: string,
    pointId: string,
    team: TeamNumberString,
): Promise<boolean> => {
    const pulling = await redisClient.get(`${gameId}:${pointId}:pulling`)
    return pulling === team
}
