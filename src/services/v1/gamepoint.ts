import * as Constants from '../../utils/constants'
import { IGamePointModel } from '../../models/gamepoint'
import { IGameModel } from '../../models/game'
import { TeamNumber } from '../../types/ultmt'
import { ApiError } from '../../types/errors'
import IGamePoint from '../../types/gamepoint'

export default class GamePointServices {
    gamePointModel: IGamePointModel
    gameModel: IGameModel

    constructor(gamePointModel: IGamePointModel, gameModel: IGameModel) {
        this.gamePointModel = gamePointModel
        this.gameModel = gameModel
    }

    /**
     * Method to create the first point of a game
     * @param gameId id of game to create point on
     * @param pullingTeam team that is pulling first
     * @returns created point
     */
    createFirstPoint = async (gameId: string, pullingTeam: TeamNumber): Promise<IGamePoint> => {
        const game = await this.gameModel.findById(gameId)
        if (!game) {
            throw new ApiError(Constants.UNABLE_TO_FIND_GAME, 404)
        }

        // check if the first point has already been verified
        const firstPoint = await this.gamePointModel.findOne({
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
        const point = await this.gamePointModel.create({
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
}
