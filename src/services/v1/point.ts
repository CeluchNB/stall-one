import * as Constants from '../../utils/constants'
import { IPointModel } from '../../models/point'
import { IGameModel } from '../../models/game'
import { Player, TeamNumber } from '../../types/ultmt'
import { ApiError } from '../../types/errors'
import IPoint from '../../types/point'

export default class PointServices {
    pointModel: IPointModel
    gameModel: IGameModel

    constructor(pointModel: IPointModel, gameModel: IGameModel) {
        this.pointModel = pointModel
        this.gameModel = gameModel
    }

    /**
     * Method to create the first point of a game
     * @param gameId id of game to create point on
     * @param pullingTeam team that is pulling first
     * @returns created point
     */
    createFirstPoint = async (gameId: string, pullingTeam: TeamNumber): Promise<IPoint> => {
        const game = await this.gameModel.findById(gameId)
        if (!game) {
            throw new ApiError(Constants.UNABLE_TO_FIND_GAME, 404)
        }

        // check if the first point has already been verified
        const firstPoint = await this.pointModel.findOne({
            gameId: game._id,
            pointNumber: 1,
        })

        if (firstPoint) {
            if (
                (pullingTeam === TeamNumber.ONE && firstPoint.pullingTeam._id?.equals(game.teamOne._id || '')) ||
                (pullingTeam === TeamNumber.TWO && firstPoint.pullingTeam._id?.equals(game.teamTwo._id || ''))
            ) {
                return firstPoint
            } else {
                throw new ApiError(Constants.CONFLICTING_POSSESSION, 400)
            }
        }

        // create the first point if it hasn't been created yet
        const point = await this.pointModel.create({
            gameId: game._id,
            pointNumber: 1,
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
}
