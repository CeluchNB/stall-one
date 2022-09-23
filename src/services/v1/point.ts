import * as Constants from '../../utils/constants'
import { IPointModel } from '../../models/point'
import { IGameModel } from '../../models/game'
import { Player, TeamNumber } from '../../types/ultmt'
import { ApiError } from '../../types/errors'
import IPoint from '../../types/point'
import IAction, { ActionType, RedisClientType } from '../../types/action'
import { IActionModel } from '../../models/action'
import { actionExists, deleteRedisAction, getRedisAction } from '../../utils/redis'

export default class PointServices {
    pointModel: IPointModel
    gameModel: IGameModel
    actionModel: IActionModel
    redisClient: RedisClientType

    constructor(pointModel: IPointModel, gameModel: IGameModel, actionModel: IActionModel, client: RedisClientType) {
        this.pointModel = pointModel
        this.gameModel = gameModel
        this.actionModel = actionModel
        this.redisClient = client
    }

    /**
     * Method to create a point in the game
     * @param gameId id of game to create point on
     * @param pullingTeam team that is pulling first
     * @returns created point
     */
    createPoint = async (gameId: string, pullingTeam: TeamNumber, pointNumber: number): Promise<IPoint> => {
        if (pointNumber < 1) {
            throw new ApiError(Constants.INVALID_DATA, 400)
        }

        const game = await this.gameModel.findById(gameId)
        if (!game) {
            throw new ApiError(Constants.UNABLE_TO_FIND_GAME, 404)
        }

        if (pointNumber > 1) {
            const prevPoint = await this.pointModel.findOne({
                gameId: game._id,
                pointNumber: pointNumber - 1,
            })

            if (!prevPoint) {
                throw new ApiError(Constants.INVALID_DATA, 400)
            }
        }

        // check if the first point has already been verified
        const pointRecord = await this.pointModel.findOne({
            gameId: game._id,
            pointNumber,
        })

        if (pointRecord) {
            if (
                (pullingTeam === TeamNumber.ONE && pointRecord.pullingTeam._id?.equals(game.teamOne._id || '')) ||
                (pullingTeam === TeamNumber.TWO && pointRecord.pullingTeam._id?.equals(game.teamTwo._id || ''))
            ) {
                return pointRecord
            } else {
                throw new ApiError(Constants.CONFLICTING_POSSESSION, 400)
            }
        }

        // create the first point if it hasn't been created yet
        const point = await this.pointModel.create({
            gameId: game._id,
            pointNumber: pointNumber,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            teamOneScore: 0,
            teamTwoScore: 0,
            teamTwoActive: game.teamTwoActive,
            pullingTeam: pullingTeam === TeamNumber.ONE ? game.teamOne : game.teamTwo,
            receivingTeam: pullingTeam === TeamNumber.ONE ? game.teamTwo : game.teamOne,
        })

        game.points.push(point._id)
        await game.save()

        return point
    }

    /**
     * Method to add players to point
     * @param pointId id of point to add players to
     * @param team team number to add players to
     * @param players array of players
     * @returns updated point
     */
    setPlayers = async (gameId: string, pointId: string, team: TeamNumber, players: Player[]): Promise<IPoint> => {
        const point = await this.pointModel.findById(pointId)
        if (!point) {
            throw new ApiError(Constants.UNABLE_TO_FIND_POINT, 404)
        }

        const game = await this.gameModel.findById(gameId)
        if (!game) {
            throw new ApiError(Constants.UNABLE_TO_FIND_GAME, 404)
        }

        if (players.length !== game.playersPerPoint) {
            throw new ApiError(Constants.WRONG_NUMBER_OF_PLAYERS, 400)
        }

        if (team === TeamNumber.ONE) {
            point.teamOnePlayers = players
        } else {
            point.teamTwoPlayers = players
        }
        await point.save()

        return point
    }

    /**
     * Method to finish a point. Moves all actions from redis to mongo, validates a
     * score occurred, sets scoring team, updates score on point and game model.
     * @param pointId id of point to finish
     * @returns final point
     */
    finishPoint = async (gameId: string, pointId: string, team: TeamNumber): Promise<IPoint> => {
        const point = await this.pointModel.findById(pointId)
        if (!point) {
            throw new ApiError(Constants.UNABLE_TO_FIND_POINT, 404)
        }

        const game = await this.gameModel.findById(gameId)
        if (!game) {
            throw new ApiError(Constants.UNABLE_TO_FIND_GAME, 404)
        }

        if (!game.points.includes(point._id)) {
            throw new ApiError(Constants.INVALID_DATA, 400)
        }

        // For first finishing team, just update boolean and return point
        if (point.teamTwoActive && team === TeamNumber.ONE) {
            point.teamOneActive = false
            await point.save()
            return point
        }

        if (point.teamOneActive && team === TeamNumber.TWO) {
            point.teamTwoActive = false
            await point.save()
            return point
        }

        let teamOneScore = false
        const actions: IAction[] = []
        // move redis actions to mongo
        const totalActions = await this.redisClient.get(`${gameId}:${pointId}:actions`)
        for (let i = 1; i <= Number(totalActions); i++) {
            const exists = await actionExists(this.redisClient, pointId, i)
            if (!exists) {
                continue
            }
            const action = await getRedisAction(this.redisClient, pointId, i)
            if (action.actionType === ActionType.TEAM_ONE_SCORE) {
                point.scoringTeam = game.teamOne
                teamOneScore = true
            } else if (action.actionType === ActionType.TEAM_TWO_SCORE) {
                point.scoringTeam = game.teamTwo
            }
            actions.push(action)
        }

        // Must have a scoring team to finish a point
        if (!point.scoringTeam) {
            throw new ApiError(Constants.SCORE_REQUIRED, 400)
        }

        // update score
        if (teamOneScore) {
            point.teamOneScore += 1
            game.teamOneScore += 1
        } else {
            point.teamTwoScore += 1
            game.teamTwoScore += 1
        }

        // create all actions at once
        const createdActions = await this.actionModel.create(actions)
        point.actions = createdActions.map((a) => a._id)

        if (team === TeamNumber.ONE) {
            point.teamOneActive = false
        } else if (team === TeamNumber.TWO) {
            point.teamTwoActive = false
        }

        // update point and game once
        await point.save()
        await game.save()

        // delete actions from redis
        for (let i = 1; i <= Number(totalActions); i++) {
            await deleteRedisAction(this.redisClient, pointId, i)
        }
        await this.redisClient.del(`${gameId}:${pointId}:actions`)

        return point
    }

    /**
     * Method to delete point. This only allows point deletion in the case of an accidentally
     * created last point. i.e. 'Next Point' was pressed instead of 'Finish Game' on the front end.
     * @param gameId id of game
     * @param pointId id of point
     * @param team one or two
     */
    deletePoint = async (gameId: string, pointId: string, team: TeamNumber): Promise<void> => {
        const game = await this.gameModel.findById(gameId)
        if (!game) {
            throw new ApiError(Constants.UNABLE_TO_FIND_GAME, 404)
        }

        const point = await this.pointModel.findById(pointId)
        if (!point) {
            throw new ApiError(Constants.UNABLE_TO_FIND_POINT, 404)
        }

        // cannot delete if other team could be editing point
        if ((team === TeamNumber.ONE && game.teamTwoActive) || (team === TeamNumber.TWO && game.teamOneActive)) {
            throw new ApiError(Constants.CANNOT_DELETE_POINT, 400)
        }

        // cannot delete if any live actions
        if (point.actions.length > 0) {
            throw new ApiError(Constants.CANNOT_DELETE_POINT, 400)
        }

        // cannot delete point if any actions exist in redis
        const totalActions = await this.redisClient.get(`${gameId}:${pointId}:actions`)
        for (let i = 1; i <= Number(totalActions); i++) {
            const exists = await actionExists(this.redisClient, pointId, i)
            if (exists) {
                throw new ApiError(Constants.CANNOT_DELETE_POINT, 404)
            }
        }

        // delete actions count and point
        await this.redisClient.del(`${gameId}:${pointId}:actions`)
        game.points = game.points.filter((id) => !id.equals(point._id))
        await game.save()
        await point.delete()
    }
}
