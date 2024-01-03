import * as Constants from '../../utils/constants'
import { IPointModel } from '../../models/point'
import { IGameModel } from '../../models/game'
import { Player, TeamNumber, TeamNumberString } from '../../types/ultmt'
import { ApiError } from '../../types/errors'
import IPoint from '../../types/point'
import IAction, { ActionType, RedisAction, RedisClientType } from '../../types/action'
import { IActionModel } from '../../models/action'
import { getRedisAction, saveRedisAction } from '../../utils/redis'
import { findByIdOrThrow, idsAreEqual } from '../../utils/mongoose'
import IGame from '../../types/game'
import { sendCloudTask } from '../../utils/cloud-tasks'
// import { finishPointQueue } from '../../background/v1'

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

        const game = await findByIdOrThrow<IGame>(gameId, this.gameModel, Constants.UNABLE_TO_FIND_GAME)

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
            teamOneActivePlayers: [],
            teamTwoActivePlayers: [],
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
        await this.redisClient.set(
            `${gameId}:${point._id.toString()}:pulling`,
            pullingTeam === TeamNumber.ONE ? 'one' : 'two',
        )
        await this.redisClient.set(
            `${gameId}:${point._id.toString()}:receiving`,
            pullingTeam === TeamNumber.ONE ? 'two' : 'one',
        )

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
        const game = await findByIdOrThrow<IGame>(gameId, this.gameModel, Constants.UNABLE_TO_FIND_GAME)
        const point = await findByIdOrThrow<IPoint>(pointId, this.pointModel, Constants.UNABLE_TO_FIND_POINT)

        if (!game.points.includes(point._id)) {
            throw new ApiError(Constants.INVALID_DATA, 400)
        }

        // if no change, skip further validation and return point
        const currentPulling = await this.redisClient.get(`${gameId}:${point._id.toString()}:pulling`)
        const newPullingTeam = pullingTeam === TeamNumber.ONE ? game.teamOne : game.teamTwo
        const newReceivingTeam = pullingTeam === TeamNumber.ONE ? game.teamTwo : game.teamOne
        if (pullingTeam === currentPulling) {
            return point
        }

        if (point.teamOneActions.length > 0 || point.teamTwoActions.length > 0) {
            throw new ApiError(Constants.MODIFY_LIVE_POINT_ERROR, 404)
        }

        const teamOneActions = await this.redisClient.get(`${gameId}:${pointId}:one:actions`)
        if (Number(teamOneActions) > 0) {
            throw new ApiError(Constants.MODIFY_LIVE_POINT_ERROR, 404)
        }

        const teamTwoActions = await this.redisClient.get(`${gameId}:${pointId}:two:actions`)
        if (Number(teamTwoActions) > 0) {
            throw new ApiError(Constants.MODIFY_LIVE_POINT_ERROR, 404)
        }

        point.pullingTeam = newPullingTeam
        point.receivingTeam = newReceivingTeam
        await this.redisClient.set(
            `${gameId}:${point._id.toString()}:pulling`,
            pullingTeam === TeamNumber.ONE ? 'one' : 'two',
        )
        await this.redisClient.set(
            `${gameId}:${point._id.toString()}:receiving`,
            pullingTeam === TeamNumber.ONE ? 'two' : 'one',
        )
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
        const point = await findByIdOrThrow<IPoint>(pointId, this.pointModel, Constants.UNABLE_TO_FIND_POINT)

        const game = await findByIdOrThrow<IGame>(gameId, this.gameModel, Constants.UNABLE_TO_FIND_GAME)

        if (!game.points.includes(point._id)) {
            throw new ApiError(Constants.INVALID_DATA, 400)
        }

        if (players.length !== game.playersPerPoint) {
            throw new ApiError(Constants.WRONG_NUMBER_OF_PLAYERS, 400)
        }

        if (team === TeamNumber.ONE) {
            point.teamOnePlayers = players
            point.teamOneActivePlayers = players
        } else {
            point.teamTwoPlayers = players
            point.teamTwoActivePlayers = players
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
        const point = await findByIdOrThrow<IPoint>(pointId, this.pointModel, Constants.UNABLE_TO_FIND_POINT)

        const game = await findByIdOrThrow<IGame>(gameId, this.gameModel, Constants.UNABLE_TO_FIND_GAME)

        if (!game.points.includes(point._id)) {
            throw new ApiError(Constants.INVALID_DATA, 400)
        }

        if ((!point.teamOneActive && team === TeamNumber.ONE) || (!point.teamTwoActive && team === TeamNumber.TWO)) {
            return point
        }

        // verify a score occurred and update action
        const totalActions = await this.redisClient.get(`${gameId}:${pointId}:${team}:actions`)
        const lastAction = await getRedisAction(this.redisClient, pointId, Number(totalActions), team)

        if (team === TeamNumber.ONE && point.teamTwoActions.length > 0) {
            // verify same score
            const reportedScore = await this.actionModel
                .findOne({ actionNumber: point.teamTwoActions.length })
                .where('_id')
                .in(point.teamTwoActions)
            if (reportedScore?.actionType !== lastAction.actionType) {
                throw new ApiError(Constants.CONFLICTING_SCORE, 400)
            }
        } else if (team === TeamNumber.TWO && point.teamOneActions.length > 0) {
            // verify same score
            const reportedScore = await this.actionModel
                .findOne({ actionNumber: point.teamOneActions.length })
                .where('_id')
                .in(point.teamOneActions)

            if (reportedScore?.actionType !== lastAction.actionType) {
                throw new ApiError(Constants.CONFLICTING_SCORE, 400)
            }
        } else {
            // update score
            if (lastAction.actionType === ActionType.TEAM_ONE_SCORE) {
                point.teamOneScore += 1
                game.teamOneScore += 1
                point.scoringTeam = game.teamOne
            } else if (lastAction.actionType === ActionType.TEAM_TWO_SCORE) {
                point.teamTwoScore += 1
                game.teamTwoScore += 1
                point.scoringTeam = game.teamTwo
            } else {
                throw new ApiError(Constants.SCORE_REQUIRED, 400)
            }
        }

        if (team === TeamNumber.ONE) {
            point.teamOneActive = false
        } else {
            point.teamTwoActive = false
        }

        const updatedPoint = await point.save()
        await game.save()

        await sendCloudTask(
            `/api/v1/point/${pointId}/background-finish`,
            {
                finishPointData: {
                    gameId,
                    team,
                },
            },
            'PUT',
        )

        return updatedPoint
    }

    /**
     * Method to delete point. This only allows point deletion in the case of an accidentally
     * created last point. i.e. 'Next Point' was pressed instead of 'Finish Game' on the front end.
     * @param gameId id of game
     * @param pointId id of point
     * @param team one or two
     */
    deletePoint = async (gameId: string, pointId: string, team: TeamNumber): Promise<void> => {
        const game = await findByIdOrThrow<IGame>(gameId, this.gameModel, Constants.UNABLE_TO_FIND_GAME)
        const point = await findByIdOrThrow<IPoint>(pointId, this.pointModel, Constants.UNABLE_TO_FIND_POINT)

        if (!game.points.includes(point._id)) {
            throw new ApiError(Constants.INVALID_DATA, 400)
        }

        // cannot delete if other team could be editing point
        if ((team === TeamNumber.ONE && game.teamTwoActive) || (team === TeamNumber.TWO && game.teamOneActive)) {
            throw new ApiError(Constants.MODIFY_LIVE_POINT_ERROR, 400)
        }

        // cannot delete if any live actions
        if (point.teamOneActions.length > 0 || point.teamTwoActions.length > 0) {
            throw new ApiError(Constants.MODIFY_LIVE_POINT_ERROR, 400)
        }

        // cannot delete point if any actions exist in redis
        const teamOneActions = await this.redisClient.get(`${gameId}:${pointId}:one:actions`)
        if (Number(teamOneActions) > 0) {
            throw new ApiError(Constants.MODIFY_LIVE_POINT_ERROR, 400)
        }

        // cannot delete point if any actions exist in redis
        const teamTwoActions = await this.redisClient.get(`${gameId}:${pointId}:two:actions`)
        if (Number(teamTwoActions) > 0) {
            throw new ApiError(Constants.MODIFY_LIVE_POINT_ERROR, 400)
        }

        // delete actions count and point
        await this.redisClient.del(`${gameId}:${pointId}:one:actions`)
        await this.redisClient.del(`${gameId}:${pointId}:two:actions`)
        game.points = game.points.filter((id) => !id.equals(point._id))
        await game.save()
        await point.delete()
    }

    /**
     * Method to reactivate a recent point to make it live again
     * @param gameId id of game point belongs to
     * @param pointId id of point to reactive
     * @param team team reactivating point
     * @returns updated point
     */
    reactivatePoint = async (gameId: string, pointId: string, team: TeamNumber): Promise<IPoint> => {
        const game = await findByIdOrThrow<IGame>(gameId, this.gameModel, Constants.UNABLE_TO_FIND_GAME)
        const point = await findByIdOrThrow<IPoint>(pointId, this.pointModel, Constants.UNABLE_TO_FIND_POINT)

        // can only reactivate the last point
        if (point.pointNumber !== game.points.length) {
            throw new ApiError(Constants.REACTIVATE_POINT_ERROR, 400)
        }

        if (team === TeamNumber.ONE) {
            game.teamOneActive = true
            point.teamOneActive = true
            // load actions back into redis
            const actions = await this.actionModel.where({ _id: { $in: point.teamOneActions } })
            await this.saveActions(actions, gameId, pointId, team)

            await this.actionModel.deleteMany({ _id: { $in: point.teamOneActions } })

            // delete actions from model
            point.teamOneActions = []
        } else {
            game.teamTwoActive = true
            point.teamTwoActive = true
            // load actions back into redis
            const actions = await this.actionModel.where({ _id: { $in: point.teamTwoActions } })
            await this.saveActions(actions, gameId, pointId, team)

            await this.actionModel.deleteMany({ _id: { $in: point.teamTwoActions } })
            // delete actions from model
            point.teamTwoActions = []
        }
        const pullingTeam = idsAreEqual(point.pullingTeam._id, game.teamOne._id) ? 'one' : 'two'
        const receivingTeam = pullingTeam === 'one' ? 'two' : 'one'
        await this.redisClient.set(`${gameId}:${pointId}:pulling`, pullingTeam)
        await this.redisClient.set(`${gameId}:${pointId}:receiving`, receivingTeam)

        // only reduce score if the other team has no actions
        // because finishPoint only updates score on first team reporting
        if (
            (team === TeamNumber.ONE && point.teamTwoActions.length === 0) ||
            (team === TeamNumber.TWO && point.teamOneActions.length === 0)
        ) {
            const prevPoint = await this.pointModel
                .findOne({ pointNumber: point.pointNumber - 1 })
                .where('_id')
                .in(game.points)

            if (prevPoint) {
                point.teamOneScore = prevPoint?.teamOneScore
                point.teamTwoScore = prevPoint?.teamTwoScore
            } else {
                point.teamOneScore = 0
                point.teamTwoScore = 0
            }

            game.teamOneScore = point.teamOneScore
            game.teamTwoScore = point.teamTwoScore
        }

        await point.save()
        await game.save()

        await sendCloudTask(
            `/api/v1/stats/point/${point._id}/delete`,
            {
                gameId: game._id,
            },
            'PUT',
        )

        return point
    }

    /**
     * Method to get the actions related to a point by team.
     * @param pointId id of point to get actions
     * @param team actions of team
     * @returns array of actions
     */
    getActionsByPoint = async (pointId: string, team: TeamNumberString): Promise<IAction[]> => {
        const point = await findByIdOrThrow<IPoint>(pointId, this.pointModel, Constants.UNABLE_TO_FIND_POINT)
        const ids = team === 'one' ? point.teamOneActions : point.teamTwoActions
        const actions = await this.actionModel.find().where('_id').in(ids)
        return actions
    }

    /**
     * Method to get all current live actions of a single point
     * @param gameId id of game
     * @param pointId id of point
     * @returns list of redis actions
     */
    getLiveActionsByPoint = async (gameId: string, pointId: string): Promise<RedisAction[]> => {
        const teamOneTotal = await this.redisClient.get(`${gameId}:${pointId}:one:actions`)
        const teamTwoTotal = await this.redisClient.get(`${gameId}:${pointId}:two:actions`)

        const onePromises = []
        const twoPromises = []
        for (let i = 1; i <= Number(teamOneTotal); i++) {
            onePromises.push(getRedisAction(this.redisClient, pointId, i, 'one'))
        }
        for (let i = 1; i <= Number(teamTwoTotal); i++) {
            twoPromises.push(getRedisAction(this.redisClient, pointId, i, 'two'))
        }
        const teamOneActions = await Promise.all(onePromises)
        const teamTwoActions = await Promise.all(twoPromises)

        return [...teamOneActions, ...teamTwoActions]
    }

    private saveActions = async (actions: IAction[], gameId: string, pointId: string, teamNumber: TeamNumber) => {
        await this.redisClient.set(`${gameId}:${pointId}:${teamNumber}:actions`, actions.length)
        for (const action of actions) {
            const redisAction: RedisAction = {
                teamNumber,
                actionNumber: action.actionNumber,
                actionType: action.actionType,
                comments: action.comments,
                tags: action.tags,
                playerOne: action.playerOne,
                playerTwo: action.playerTwo,
            }
            await saveRedisAction(this.redisClient, redisAction, pointId)
        }
    }
}
