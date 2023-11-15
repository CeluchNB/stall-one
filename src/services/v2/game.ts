import * as Constants from '../../utils/constants'
import { ApiError } from '../../types/errors'
import { IActionModel } from '../../models/action'
import IGame from '../../types/game'
import { IGameModel } from '../../models/game'
import IPoint from '../../types/point'
import { IPointModel } from '../../models/point'
import { Response } from 'express'
import { TeamNumberString } from '../../types/ultmt'
import { authenticateManager } from '../../utils/ultmt'
import { findByIdOrThrow } from '../../utils/mongoose'
import { getRedisAction } from '../../utils/redis'
import IAction, { RedisAction, RedisClientType } from '../../types/action'

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
    reactivateGame = async (gameId: string, userJwt: string, teamId: string, res: Response) => {
        try {
            const game = await findByIdOrThrow<IGame>(gameId, this.gameModel, Constants.UNABLE_TO_FIND_GAME)

            const team: TeamNumberString = this.getTeamNumber(game, teamId)

            await authenticateManager(this.ultmtUrl, this.apiKey, userJwt, teamId)

            const token = game.getToken(team)
            if (team === 'one') {
                game.teamOneActive = true
            } else {
                game.teamTwoActive = true
            }
            await game.save()

            res.write({ game, token })

            const points = await this.pointModel.find({ _id: { $in: game.points } })
            for (const point of points) {
                res.write({ point })
                const active = team === 'one' ? point.teamOneActive : point.teamTwoActive

                const actions = []
                if (active) {
                    actions.push(...(await this.getLiveActionsForPoint(gameId, point._id.toHexString(), team)))
                } else {
                    actions.push(...(await this.getSavedActionsForPoint(team, point)))
                }
                res.write({ actions })
            }
        } catch (_e) {
            res.write({ error: Constants.GENERIC_ERROR })
        } finally {
            res.end()
        }
    }

    private getTeamNumber = (game: IGame, teamId: string): TeamNumberString => {
        if (game.teamOne._id?.equals(teamId)) {
            return 'one'
        } else if (game.teamTwo._id?.equals(teamId)) {
            return 'two'
        } else {
            throw new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 40)
        }
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

    private getSavedActionsForPoint = async (team: TeamNumberString, point: IPoint): Promise<IAction[]> => {
        const actionIds = team === 'one' ? point.teamOneActions : point.teamTwoActions
        return await this.actionModel.find({ _id: { $in: actionIds } })
    }
}
