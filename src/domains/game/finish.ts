import * as Constants from '../../utils/constants'
import Dependencies from '../../types/di'
import { findByIdOrThrow } from '../../utils/mongoose'
import IGame, { GameStatus } from '../../types/game'
import { TeamNumber } from '../../types/ultmt'
import { PointStatus } from '../../types/point'

export const finishGame = ({ gameModel, pointModel }: Dependencies) => {
    const perform = async (gameId: string, team: TeamNumber) => {
        const game = await findByIdOrThrow<IGame>(gameId, gameModel, Constants.UNABLE_TO_FIND_GAME)

        if (team === TeamNumber.ONE) {
            game.teamOneStatus = GameStatus.COMPLETE
        } else if (team === TeamNumber.TWO) {
            game.teamTwoStatus = GameStatus.COMPLETE
        }

        await pointModel.deleteMany({
            gameId,
            teamOneStatus: PointStatus.FUTURE,
            teamTwoStatus: PointStatus.FUTURE,
        })

        await game.save()
        return game
    }

    return { perform }
}

export type FinishGame = ReturnType<typeof finishGame>
