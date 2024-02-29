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
import PointServices from '../v1/point'

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
        const team = getTeamNumber(game, teamId)
        const token = game.getToken(team)

        if (team === 'one') {
            game.teamOneActive = true
        } else if (team === 'two') {
            game.teamTwoActive = true
        }
        await game.save()

        // get most recent point in game
        let activePoint: IPoint | null = await this.pointModel
            .findOne({ _id: { $in: game.points } })
            .sort('-pointNumber')

        if (!activePoint) {
            return { game, team, token, activePoint: undefined, actions: [] }
        }

        const actions = []
        if ((team === 'one' && !activePoint.teamOneActive) || (team === 'two' && !activePoint.teamTwoActive)) {
            // reactivate point if it was previously inactive
            const pointService = new PointServices(this.pointModel, this.gameModel, this.actionModel, this.redisClient)
            activePoint = await pointService.reactivatePoint(
                game._id.toHexString(),
                activePoint._id.toHexString(),
                team,
            )
        }

        // game actions will always be in redis after reactivate
        actions.push(
            ...(await this.getLiveActionsForPoint(game._id.toHexString(), activePoint._id.toHexString(), team)),
        )

        return { game, team, token, activePoint, actions }
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
}
