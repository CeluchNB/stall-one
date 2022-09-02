import IAction, { RedisClientType, ActionType } from '../types/action'
import { getActionBaseKey } from './utils'
import { Types } from 'mongoose'

export const saveRedisAction = async (redisClient: RedisClientType, data: IAction) => {
    const { pointId, actionNumber: number, team, playerOne, playerTwo, displayMessage, tags, actionType } = data
    const { _id, place, name, teamname, seasonStart, seasonEnd } = team
    const baseKey = getActionBaseKey(pointId.toString(), number)
    await redisClient.hSet(`${baseKey}:team`, 'id', _id?.toString() || '')
    await redisClient.hSet(`${baseKey}:team`, 'place', place || '')
    await redisClient.hSet(`${baseKey}:team`, 'name', name)
    await redisClient.hSet(`${baseKey}:team`, 'teamname', teamname || '')
    await redisClient.hSet(`${baseKey}:team`, 'seasonStart', new Date(seasonStart || '').getFullYear())
    await redisClient.hSet(`${baseKey}:team`, 'seasonEnd', new Date(seasonEnd || '').getFullYear())

    await redisClient.set(`${baseKey}:type`, actionType)
    await redisClient.set(`${baseKey}:display`, displayMessage)
    if (playerOne) {
        await redisClient.hSet(`${pointId}:${number}:playerone`, 'id', playerOne._id?.toString() || '')
        await redisClient.hSet(`${pointId}:${number}:playerone`, 'firstName', playerOne.firstName)
        await redisClient.hSet(`${pointId}:${number}:playerone`, 'lastName', playerOne.lastName)
        await redisClient.hSet(`${pointId}:${number}:playerone`, 'username', playerOne.username || '')
    }
    if (playerTwo) {
        await redisClient.hSet(`${pointId}:${number}:playertwo`, 'id', playerTwo._id?.toString() || '')
        await redisClient.hSet(`${pointId}:${number}:playertwo`, 'firstName', playerTwo.firstName)
        await redisClient.hSet(`${pointId}:${number}:playertwo`, 'lastName', playerTwo.lastName)
        await redisClient.hSet(`${pointId}:${number}:playertwo`, 'username', playerTwo.username || '')
    }
    for (const tag of tags) {
        await redisClient.lPush(`${pointId}:${number}:tags`, tag)
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
    const tagLength = await redisClient.lLen(`${baseKey}:tags`)
    const tags = await redisClient.lRange(`${baseKey}:tags`, 0, tagLength)

    return {
        pointId: new Types.ObjectId(pointId),
        actionNumber: number,
        team: {
            _id: new Types.ObjectId(teamId),
            place: teamPlace,
            name: teamName,
            teamname: teamTeamname,
            seasonStart: teamStart ? new Date(teamStart) : undefined,
            seasonEnd: teamEnd ? new Date(teamEnd) : undefined,
        },
        actionType: actionType as ActionType,
        displayMessage,
        playerOne: playerOne.firstName
            ? {
                  _id: new Types.ObjectId(playerOne.id || ''),
                  firstName: playerOne.firstName,
                  lastName: playerOne.lastName,
                  username: playerOne.username || '',
              }
            : undefined,
        playerTwo: playerTwo.firstName
            ? {
                  _id: new Types.ObjectId(playerTwo.id || 0),
                  firstName: playerTwo.firstName,
                  lastName: playerTwo.lastName,
                  username: playerTwo.username || '',
              }
            : undefined,
        tags,
        comments: [],
    }
}
