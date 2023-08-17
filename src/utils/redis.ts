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

    const transaction = redisClient.multi().set(`${baseKey}:type`, actionType)
    if (playerOne) {
        if (playerOne._id) {
            transaction.hSet(`${baseKey}:playerone`, 'id', playerOne._id.toString())
        }
        transaction.hSet(`${baseKey}:playerone`, 'firstName', playerOne.firstName)
        transaction.hSet(`${baseKey}:playerone`, 'lastName', playerOne.lastName)
        if (playerOne.username) {
            transaction.hSet(`${baseKey}:playerone`, 'username', playerOne.username)
        }
    }
    if (playerTwo) {
        if (playerTwo._id) {
            transaction.hSet(`${baseKey}:playertwo`, 'id', playerTwo._id.toString())
        }
        transaction.hSet(`${baseKey}:playertwo`, 'firstName', playerTwo.firstName)
        transaction.hSet(`${baseKey}:playertwo`, 'lastName', playerTwo.lastName)
        if (playerTwo.username) {
            transaction.hSet(`${baseKey}:playertwo`, 'username', playerTwo.username)
        }
    }
    for (const tag of tags) {
        transaction.rPush(`${baseKey}:tags`, tag)
    }
    await transaction.exec()
}

export const getRedisAction = async (
    redisClient: RedisClientType,
    pointId: string,
    actionNumber: number,
    teamNumber: TeamNumberString,
): Promise<RedisAction> => {
    const baseKey = getActionBaseKey(pointId, actionNumber, teamNumber)
    const transaction = redisClient
        .multi()
        .get(`${baseKey}:type`)
        .hGetAll(`${baseKey}:playerone`)
        .hGetAll(`${baseKey}:playertwo`)
        .lRange(`${baseKey}:tags`, 0, -1)
    const totalComments = await redisClient.get(`${baseKey}:comments`)

    for (let i = 1; i <= Number(totalComments); i++) {
        transaction.get(`${baseKey}:comments:${i}:text`).hGetAll(`${baseKey}:comments:${i}:user`)
    }
    const result = await transaction.exec()

    const actionType = result[0]
    const playerOne = result[1]
    const playerTwo = result[2]
    const tags = result[3]

    const comments: Comment[] = []
    type StringObject = { [x: string]: string }
    for (let i = 4; i < 4 + Number(totalComments) * 2; i += 2) {
        const comment = result[i]
        const commentor = result[i + 1]
        const user = parseRedisUser(commentor as unknown as StringObject) as Player
        if (comment) {
            comments.push({ comment: comment as unknown as string, user, commentNumber: i / 2 - 1 })
        }
    }

    const action: RedisAction = {
        teamNumber,
        actionNumber,
        actionType: actionType as ActionType,
        tags: tags as unknown as string[],
        comments,
    }

    action.playerOne = parseRedisUser(playerOne as unknown as StringObject)
    action.playerTwo = parseRedisUser(playerTwo as unknown as StringObject)

    return action
}

export const deleteRedisAction = async (
    redisClient: RedisClientType,
    pointId: string,
    number: number,
    teamNumber: TeamNumberString,
) => {
    const baseKey = getActionBaseKey(pointId, number, teamNumber)
    await redisClient
        .multi()
        .del(`${baseKey}:type`)
        .del(`${baseKey}:playerone`)
        .del(`${baseKey}:playertwo`)
        .del(`${baseKey}:tags`)
        .del(`${baseKey}:comments`)
        .exec()
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
    await redisClient
        .multi()
        .set(`${baseKey}:comments:${totalComments}:text`, data.comment)
        .hSet(`${baseKey}:comments:${totalComments}:user`, 'id', data.user._id.toString())
        .hSet(`${baseKey}:comments:${totalComments}:user`, 'username', data.user.username)
        .hSet(`${baseKey}:comments:${totalComments}:user`, 'firstName', data.user.firstName)
        .hSet(`${baseKey}:comments:${totalComments}:user`, 'lastName', data.user.lastName)
        .exec()
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
