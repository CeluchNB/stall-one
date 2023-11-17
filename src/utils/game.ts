import * as Constants from '../utils/constants'
import { ApiError } from '../types/errors'
import IGame from '../types/game'
import { TeamNumberString } from '../types/ultmt'

export const getTeamNumber = (game: IGame, teamId: string): TeamNumberString => {
    if (game.teamOne._id?.equals(teamId)) {
        return 'one'
    } else if (game.teamTwo._id?.equals(teamId)) {
        return 'two'
    }
    throw new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 404)
}
