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
            const prevPoint = await this.pointModel
                .findOne({
                    pointNumber: pointNumber - 1,
                })
                .where('_id')
                .in(game.points)

            if (!prevPoint) {
                throw new ApiError(Constants.INVALID_DATA, 400)
            }
        }

        // check if this point has already been created
        const pointRecord = await this.pointModel
            .findOne({
                pointNumber,
            })
            .where('_id')
            .in(game.points)

        if (pointRecord) {
            // checking name because it is only guaranteed field available
            // since it is set from the game teams' names, it should be safe
            if (
                (pullingTeam === TeamNumber.ONE && pointRecord.pullingTeam.name === game.teamOne.name) ||
                (pullingTeam === TeamNumber.TWO && pointRecord.pullingTeam.name === game.teamTwo.name)
            ) {
                return pointRecord
            } else {
                throw new ApiError(Constants.CONFLICTING_POSSESSION, 400)
            }
        }

        // create the first point if it hasn't been created yet
        const point = await this.pointModel.create({
            pointNumber: pointNumber,
            teamOnePlayers: [],
            teamTwoPlayers: [],
            teamOneScore: game.teamOneScore,
            teamTwoScore: game.teamTwoScore,
            teamTwoActive: game.teamTwoActive,
            pullingTeam: pullingTeam === TeamNumber.ONE ? game.teamOne : game.teamTwo,
            receivingTeam: pullingTeam === TeamNumber.ONE ? game.teamTwo : game.teamOne,
        })

        game.points.push(point._id)
        await game.save()

        // set actions to 0 when creating point
        // allows for validation on key existence later
        await this.redisClient.set(`${gameId}:${point._id.toString()}:one:actions`, 0)
        await this.redisClient.set(`${gameId}:${point._id.toString()}:two:actions`, 0)

        return point
    }

    /**
     * Method to edit a previously created point's pulling/receiving teams. The motivation
     * for this method is to allow user's to fix a point that has been created with the wrong pulling configuration
     * without, since they cannot delete a point in an active game.
     * @param gameId id of game
     * @param pointId id of point
     * @param pullingTeam pulling team
     * @returns updated point
     */
    setPullingTeam = async (gameId: string, pointId: string, pullingTeam: TeamNumber): Promise<IPoint> => {
        const game = await this.gameModel.findById(gameId)
        if (!game) {
            throw new ApiError(Constants.UNABLE_TO_FIND_GAME, 404)
        }

        const point = await this.pointModel.findById(pointId)
        if (!point) {
            throw new ApiError(Constants.UNABLE_TO_FIND_POINT, 404)
        }

        if (!game.points.includes(point._id)) {
            throw new ApiError(Constants.INVALID_DATA, 400)
        }

        // if no change, skip further validation and return point
        const newPullingTeam = pullingTeam === TeamNumber.ONE ? game.teamOne : game.teamTwo
        const newReceivingTeam = pullingTeam === TeamNumber.ONE ? game.teamTwo : game.teamOne
        if (point.pullingTeam.name === newPullingTeam.name) {
            return point
        }

        if (point.actions.length > 0) {
            throw new ApiError(Constants.MODIFY_LIVE_POINT_ERROR, 404)
        }

        const teamOneActions = await this.redisClient.get(`${gameId}:${pointId}:one:actions`)
        for (let i = 1; i <= Number(teamOneActions); i++) {
            const exists = await actionExists(this.redisClient, pointId, i, 'one')
            if (exists) {
                throw new ApiError(Constants.MODIFY_LIVE_POINT_ERROR, 404)
            }
        }

        const teamTwoActions = await this.redisClient.get(`${gameId}:${pointId}:two:actions`)
        for (let i = 1; i <= Number(teamTwoActions); i++) {
            const exists = await actionExists(this.redisClient, pointId, i, 'one')
            if (exists) {
                throw new ApiError(Constants.MODIFY_LIVE_POINT_ERROR, 404)
            }
        }

        point.pullingTeam = newPullingTeam
        point.receivingTeam = newReceivingTeam
        await point.save()

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

        if (!game.points.includes(point._id)) {
            throw new ApiError(Constants.INVALID_DATA, 400)
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

        // return point if team already marked as finished
        if ((!point.teamOneActive && team === TeamNumber.ONE) || (!point.teamTwoActive && team === TeamNumber.TWO)) {
            return point
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

        // TODO: rework this
        let teamOneScore = false
        const actions: IAction[] = []
        // move teams' redis actions to mongo
        const teamOneActions = await this.redisClient.get(`${gameId}:${pointId}:one:actions`)
        for (let i = 1; i <= Number(teamOneActions); i++) {
            const exists = await actionExists(this.redisClient, pointId, i, 'one')
            if (!exists) {
                continue
            }
            const action = await getRedisAction(this.redisClient, pointId, i, 'one')
            if (action.actionType === ActionType.TEAM_ONE_SCORE) {
                point.scoringTeam = game.teamOne
                teamOneScore = true
            } else if (action.actionType === ActionType.TEAM_TWO_SCORE) {
                point.scoringTeam = game.teamTwo
            }
            actions.push(action)
        }

        const teamTwoActions = await this.redisClient.get(`${gameId}:${pointId}:two:actions`)
        for (let i = 1; i <= Number(teamTwoActions); i++) {
            const exists = await actionExists(this.redisClient, pointId, i, 'two')
            if (!exists) {
                continue
            }
            const action = await getRedisAction(this.redisClient, pointId, i, 'two')
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
            // delete actions from redis
            for (let i = 1; i <= Number(teamOneActions); i++) {
                await deleteRedisAction(this.redisClient, pointId, i, 'one')
            }
        } else if (team === TeamNumber.TWO) {
            point.teamTwoActive = false
            for (let i = 1; i <= Number(teamTwoActions); i++) {
                await deleteRedisAction(this.redisClient, pointId, i, 'two')
            }
        }

        // update point and game once
        await point.save()
        await game.save()
        await this.redisClient.del(`${gameId}:${pointId}:${team}:actions`)

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

        if (!game.points.includes(point._id)) {
            throw new ApiError(Constants.INVALID_DATA, 400)
        }

        // cannot delete if other team could be editing point
        if ((team === TeamNumber.ONE && game.teamTwoActive) || (team === TeamNumber.TWO && game.teamOneActive)) {
            throw new ApiError(Constants.MODIFY_LIVE_POINT_ERROR, 400)
        }

        // cannot delete if any live actions
        if (point.actions.length > 0) {
            throw new ApiError(Constants.MODIFY_LIVE_POINT_ERROR, 400)
        }

        // cannot delete point if any actions exist in redis
        const teamOneActions = await this.redisClient.get(`${gameId}:${pointId}:one:actions`)
        for (let i = 1; i <= Number(teamOneActions); i++) {
            const exists = await actionExists(this.redisClient, pointId, i, 'one')
            if (exists) {
                throw new ApiError(Constants.MODIFY_LIVE_POINT_ERROR, 404)
            }
        }

        // cannot delete point if any actions exist in redis
        const teamTwoActions = await this.redisClient.get(`${gameId}:${pointId}:two:actions`)
        for (let i = 1; i <= Number(teamTwoActions); i++) {
            const exists = await actionExists(this.redisClient, pointId, i, 'two')
            if (exists) {
                throw new ApiError(Constants.MODIFY_LIVE_POINT_ERROR, 404)
            }
        }

        // delete actions count and point
        await this.redisClient.del(`${gameId}:${pointId}:one:actions`)
        await this.redisClient.del(`${gameId}:${pointId}:two:actions`)
        game.points = game.points.filter((id) => !id.equals(point._id))
        await game.save()
        await point.delete()
    }
}
