import * as Constants from '../utils/constants'
import { ApiError } from '../types/errors'
import IGame from '../types/game'
import { TeamNumber } from '../types/ultmt'

export const getTeamNumber = (game: IGame, teamId: string): TeamNumber => {
    if (game.teamOne._id?.equals(teamId)) {
        return TeamNumber.ONE
    } else if (game.teamTwo._id?.equals(teamId)) {
        return TeamNumber.TWO
    }
    throw new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 404)
}
