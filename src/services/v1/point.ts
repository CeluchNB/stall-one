import * as Constants from '../../utils/constants'
import { IPointModel } from '../../models/point'
import { IGameModel } from '../../models/game'
import { Player, TeamNumber } from '../../types/ultmt'
import { ApiError } from '../../types/errors'
import IPoint from '../../types/point'
import { RedisClientType } from '../../types/action'

export default class PointServices {
    pointModel: IPointModel
    gameModel: IGameModel
    client?: RedisClientType

    constructor(pointModel: IPointModel, gameModel: IGameModel, client?: RedisClientType) {
        this.pointModel = pointModel
        this.gameModel = gameModel
        this.client = client
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
            pullingTeam: pullingTeam === TeamNumber.ONE ? game.teamOne : game.teamTwo,
            receivingTeam: pullingTeam === TeamNumber.ONE ? game.teamTwo : game.teamOne,
        })

        return point
    }

    /**
     * Method to add players to point
     * @param pointId id of point to add players to
     * @param team team number to add players to
     * @param players array of players
     * @returns updated point
     */
    setPlayers = async (pointId: string, team: TeamNumber, players: Player[]): Promise<IPoint> => {
        const point = await this.pointModel.findById(pointId)
        if (!point) {
            throw new ApiError(Constants.UNABLE_TO_FIND_POINT, 404)
        }

        const game = await this.gameModel.findById(point.gameId)
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
    finishPoint = async (pointId: string): Promise<IPoint> => {
        const point = await this.pointModel.findById(pointId)
        if (!point) {
            throw new ApiError(Constants.UNABLE_TO_FIND_POINT, 404)
        }

        return point
    }
}
