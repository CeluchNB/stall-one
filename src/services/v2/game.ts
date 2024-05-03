import * as Constants from '../../utils/constants'
import { IActionModel } from '../../models/action'
import IGame, { CreateFullGame, GameStatus } from '../../types/game'
import { IGameModel } from '../../models/game'
import IPoint, { PointStatus } from '../../types/point'
import { IPointModel } from '../../models/point'
import { Player, TeamNumber, TeamNumberString } from '../../types/ultmt'
import { authenticateManager } from '../../utils/ultmt'
import { findByIdOrThrow } from '../../utils/mongoose'
import { getRedisAction } from '../../utils/redis'
import { RedisAction, RedisClientType } from '../../types/action'
import { getTeamNumber } from '../../utils/game'
import PointServices from '../v1/point'
import Dependencies from '../../types/di'
import { ApiError } from '../../types/errors'
import { sendCloudTask } from '../../utils/cloud-tasks'

export default class GameServices {
    gameModel: IGameModel
    pointModel: IPointModel
    actionModel: IActionModel
    finishPoint: Dependencies['finishPoint']
    finishGame: Dependencies['finishGame']
    fullGame: Dependencies['fullGame']
    reenterGame: Dependencies['reenterGame']
    redisClient: RedisClientType
    ultmtUrl: string
    apiKey: string

    constructor(opts: Dependencies) {
        this.gameModel = opts.gameModel
        this.pointModel = opts.pointModel
        this.actionModel = opts.actionModel
        this.redisClient = opts.redisClient
        this.ultmtUrl = opts.ultmtUrl
        this.apiKey = opts.apiKey
        this.finishPoint = opts.finishPoint
        this.finishGame = opts.finishGame
        this.fullGame = opts.fullGame
        this.reenterGame = opts.reenterGame
    }
    /**
     * Method to reactivate a game that has been finished or delayed
     * @param gameId id of game to reactivate
     * @param userJwt user to validate as team manager
     * @param teamId team that is in game
     *
     * @deprecated
     * This endpoint has been deprecated in favor of the /reenter endpoint
     */
    reactivateGame = async (gameId: string, userJwt: string, teamId: string) => {
        await authenticateManager(this.ultmtUrl, this.apiKey, userJwt, teamId)

        const game = await findByIdOrThrow<IGame>(gameId, this.gameModel, Constants.UNABLE_TO_FIND_GAME)
        const team = getTeamNumber(game, teamId)
        const token = game.getToken(team)

        if (team === 'one') {
            game.teamOneActive = true
            game.teamOneStatus = GameStatus.ACTIVE
        } else if (team === 'two') {
            game.teamTwoActive = true
            game.teamTwoStatus = GameStatus.ACTIVE
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
        if (
            (team === 'one' && activePoint.teamOneStatus !== PointStatus.ACTIVE) ||
            (team === 'two' && activePoint.teamTwoStatus !== PointStatus.ACTIVE)
        ) {
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

    finish = async (gameId: string, team: TeamNumber): Promise<IGame> => {
        const lastPoint = await this.pointModel.findOne({ gameId }).sort('-pointNumber')
        if (!lastPoint) throw new ApiError(Constants.UNABLE_TO_FIND_POINT, 404)

        await this.finishPoint.perform(gameId, team, lastPoint._id.toHexString())
        await sendCloudTask(
            `/api/v1/point/${lastPoint._id}/background-finish`,
            {
                finishPointData: {
                    gameId,
                    team,
                },
            },
            'PUT',
        )

        const game = await this.finishGame.perform(gameId, team)
        await sendCloudTask(`/api/v1/stats/game/finish/${gameId}`, { pointTotal: lastPoint.pointNumber }, 'PUT')

        return game
    }

    full = async (gameData: CreateFullGame, jwt: string): Promise<Map<string, Player>> => {
        return await this.fullGame.perform(gameData, jwt)
    }

    reenter = async (gameId: string, userJwt: string, teamId: string) => {
        return await this.reenterGame.perform(gameId, userJwt, teamId)
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
