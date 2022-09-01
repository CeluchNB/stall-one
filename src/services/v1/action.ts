import Action, { IActionModel } from '../../models/action'
import IAction, { RedisClientType, ClientAction, ActionType } from '../../types/action'
import { Player } from '../../types/ultmt'
import { Types } from 'mongoose'

export default class ActionServices {
    redisClient: RedisClientType
    actionModel: IActionModel

    constructor(redisClient: RedisClientType, actionModel: IActionModel = Action) {
        this.redisClient = redisClient
        this.actionModel = actionModel
    }

    createRedisAction = async (data: ClientAction, gameId: string): Promise<IAction> => {
        const actionNumber = await this.redisClient.incr(`${gameId}:${data.pointId}:actions`)
        const action = this.parseActionData(data, actionNumber)
        await this.saveRedisAction(action)

        return action
    }

    getRedisAction = async (pointId: string, number: number): Promise<IAction> => {
        const teamId = await this.redisClient.hGet(`${pointId}:${number}:team`, 'id')
        const teamPlace = await this.redisClient.hGet(`${pointId}:${number}:team`, 'place')
        const teamName = (await this.redisClient.hGet(`${pointId}:${number}:team`, 'name')) as string
        const teamTeamname = await this.redisClient.hGet(`${pointId}:${number}:team`, 'teamname')
        const teamStart = await this.redisClient.hGet(`${pointId}:${number}:team`, 'seasonStart')
        const teamEnd = await this.redisClient.hGet(`${pointId}:${number}:team`, 'seasonEnd')
        const actionType = await this.redisClient.get(`${pointId}:${number}:type`)
        const displayMessage = (await this.redisClient.get(`${pointId}:${number}:display`)) as string
        const playerOne = await this.redisClient.hGetAll(`${pointId}:${number}:playerone`)
        const playerTwo = await this.redisClient.hGetAll(`${pointId}:${number}:playertwo`)
        const tagLength = await this.redisClient.lLen(`${pointId}:${number}:tags`)
        const tags = await this.redisClient.lRange(`${pointId}:${number}:tags`, 0, tagLength)

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
            playerOne: playerOne
                ? {
                      _id: new Types.ObjectId(playerOne.id || ''),
                      firstName: playerOne.firstName,
                      lastName: playerOne.lastName,
                      username: playerOne.username || '',
                  }
                : undefined,
            playerTwo: playerTwo
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

    private parseActionData = (data: ClientAction, actionNumber: number): IAction => {
        let action: IAction
        switch (data.actionType) {
            case ActionType.PULL:
                action = {
                    ...data,
                    actionNumber,
                    displayMessage: this.getDisplayMessage(ActionType.PULL, data.playerOne),
                    comments: [],
                }
                break
            default:
                action = {
                    ...data,
                    actionNumber,
                    displayMessage: this.getDisplayMessage(ActionType.CALL_ON_FIELD),
                    comments: [],
                }
        }
        return action
    }

    private saveRedisAction = async (data: IAction) => {
        const { pointId, actionNumber: number, team, playerOne, playerTwo, displayMessage, tags, actionType } = data
        await this.redisClient.hSet(`${pointId}:${number}:team`, 'id', team._id?.toString() || '')
        await this.redisClient.hSet(`${pointId}:${number}:team`, 'place', team.place || '')
        await this.redisClient.hSet(`${pointId}:${number}:team`, 'name', team.name)
        await this.redisClient.hSet(`${pointId}:${number}:team`, 'teamname', team.teamname || '')
        await this.redisClient.hSet(
            `${pointId}:${number}:team`,
            'seasonStart',
            new Date(team.seasonStart || '').getFullYear() || '',
        )
        await this.redisClient.hSet(
            `${pointId}:${number}:team`,
            'seasonEnd',
            new Date(team.seasonEnd || '').getFullYear() || '',
        )

        await this.redisClient.set(`${pointId}:${number}:type`, actionType)
        await this.redisClient.set(`${pointId}:${number}:display`, displayMessage)
        if (playerOne) {
            await this.redisClient.hSet(`${pointId}:${number}:playerone`, 'id', playerOne?._id?.toString() || '')
            await this.redisClient.hSet(`${pointId}:${number}:playerone`, 'firstName', playerOne?.firstName || '')
            await this.redisClient.hSet(`${pointId}:${number}:playerone`, 'lastName', playerOne?.lastName || '')
            await this.redisClient.hSet(`${pointId}:${number}:playerone`, 'username', playerOne?.username || '')
        }
        if (playerTwo) {
            await this.redisClient.hSet(`${pointId}:${number}:playertwo`, 'id', playerTwo?._id?.toString() || '')
            await this.redisClient.hSet(`${pointId}:${number}:playertwo`, 'firstName', playerTwo?.firstName || '')
            await this.redisClient.hSet(`${pointId}:${number}:playertwo`, 'lastName', playerTwo?.lastName || '')
            await this.redisClient.hSet(`${pointId}:${number}:playertwo`, 'username', playerTwo?.username || '')
        }
        for (const tag of tags) {
            await this.redisClient.lPush(`${pointId}:${number}:tags`, tag)
        }
    }

    private getDisplayMessage = (type: ActionType, playerOne?: Player, playerTwo?: Player): string => {
        switch (type) {
            case ActionType.PULL:
                return `${playerOne?.firstName} ${playerOne?.lastName} pulls the disc`
            default:
                return 'An action occurred.'
        }
    }
}
