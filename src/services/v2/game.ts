import * as Constants from '../../utils/constants'
import { IActionModel } from '../../models/action'
import IGame from '../../types/game'
import { IGameModel } from '../../models/game'
import IPoint from '../../types/point'
import { IPointModel } from '../../models/point'
import { TeamNumberString } from '../../types/ultmt'
import { authenticateManager } from '../../utils/ultmt'
import { findByIdOrThrow } from '../../utils/mongoose'
import { getRedisAction } from '../../utils/redis'
import { RedisAction, RedisClientType } from '../../types/action'
import { getTeamNumber } from '../../utils/game'

export default class GameServices {
    gameModel: IGameModel
    pointModel: IPointModel
    actionModel: IActionModel
    redisClient: RedisClientType
    ultmtUrl: string
    apiKey: string

    constructor(
        gameModel: IGameModel,
        pointModel: IPointModel,
        actionModel: IActionModel,
        redisClient: RedisClientType,
        ultmtUrl: string,
        apiKey: string,
    ) {
        this.gameModel = gameModel
        this.pointModel = pointModel
        this.actionModel = actionModel
        this.redisClient = redisClient
        this.ultmtUrl = ultmtUrl
        this.apiKey = apiKey
    }
    /**
     * Method to reactivate a game that has been finished or delayed
     * @param gameId id of game to reactivate
     * @param userJwt user to validate as team manager
     * @param teamId team that is in game
     */
    reactivateGame = async (gameId: string, userJwt: string, teamId: string) => {
        await authenticateManager(this.ultmtUrl, this.apiKey, userJwt, teamId)

        const game = await findByIdOrThrow<IGame>(gameId, this.gameModel, Constants.UNABLE_TO_FIND_GAME)
        const team: TeamNumberString = getTeamNumber(game, teamId)

        if (team === 'one') {
            game.teamOneActive = true
        } else if (team === 'two') {
            game.teamTwoActive = true
        }
        await game.save()

        const activePoint = await this.pointModel.findOne({ _id: { $in: game.points } }).sort('-pointNumber')

        if (!activePoint) {
            return { game, team, activePoint: undefined, actions: [] }
        }

        const actions = []
        if ((team === 'one' && activePoint.teamOneActive) || (team === 'two' && activePoint.teamTwoActive)) {
            actions.push(
                ...(await this.getLiveActionsForPoint(game._id.toHexString(), activePoint._id.toHexString(), team)),
            )
        } else {
            actions.push(...(await this.getSavedActionsForPoint(team, activePoint)))
        }

        if (team === 'one') {
            activePoint.teamOneActive = true
        } else if (team === 'two') {
            activePoint.teamTwoActive = true
        }
        await activePoint.save()

        return { game, team, activePoint, actions }
    }

    private getLiveActionsForPoint = async (
        gameId: string,
        pointId: string,
        team: TeamNumberString,
    ): Promise<RedisAction[]> => {
        const actionCount = await this.redisClient.get(`${gameId}:${pointId}:${team}:actions`)
        const actionPromises = []
        for (let i = 1; i <= Number(actionCount); i++) {
            actionPromises.push(getRedisAction(this.redisClient, pointId, i, team))
        }
        return await Promise.all(actionPromises)
    }

    private getSavedActionsForPoint = async (team: TeamNumberString, point: IPoint): Promise<RedisAction[]> => {
        const actionIds = team === 'one' ? point.teamOneActions : point.teamTwoActions
        return (await this.actionModel.find({ _id: { $in: actionIds } })).map((action) => ({
            ...action,
            teamNumber: team,
        }))
    }
}
