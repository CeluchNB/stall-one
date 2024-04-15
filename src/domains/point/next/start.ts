import * as Constants from '../../../utils/constants'
import Dependencies from '../../../types/di'
import IGame from '../../../types/game'
import { findByIdOrThrow } from '../../../utils/mongoose'
import IPoint, { PointStatus } from '../../../types/point'
import { TeamNumber } from '../../../types/ultmt'

export const startPoint = ({ pointModel, gameModel, redisClient }: Dependencies) => {
    const perform = async (
        gameId: string,
        team: TeamNumber,
        pointNumber: number,
        pullingTeam: TeamNumber,
    ): Promise<IPoint> => {
        const game = await findByIdOrThrow<IGame>(gameId, gameModel, Constants.UNABLE_TO_FIND_GAME)
        const newPoint = await createNewPoint(game, team, pointNumber, pullingTeam)
        await setupRedisData(gameId, newPoint._id.toHexString(), pullingTeam)

        return newPoint
    }

    const createNewPoint = async (
        game: IGame,
        team: TeamNumber,
        pointNumber: number,
        pullingTeamNumber: TeamNumber,
    ): Promise<IPoint> => {
        const teamStatus = isTeamOne(team, { teamOneStatus: PointStatus.ACTIVE }, { teamTwoStatus: PointStatus.ACTIVE })
        const pullingTeam = isTeamOne(pullingTeamNumber, game.teamOne, game.teamTwo)
        const receivingTeam = isTeamOne(pullingTeamNumber, game.teamTwo, game.teamOne)

        const newPoint = await pointModel.findOneAndUpdate(
            { gameId: game._id, pointNumber: pointNumber + 1 },
            {
                ...teamStatus,
                teamOneScore: game.teamOneScore,
                teamTwoScore: game.teamTwoScore,
                pullingTeam,
                receivingTeam,
            },
            { upsert: true, new: true },
        )

        return newPoint
    }

    const setupRedisData = async (gameId: string, pointId: string, pullingTeam: TeamNumber) => {
        await redisClient.set(`${gameId}:${pointId}:one:actions`, 0)
        await redisClient.set(`${gameId}:${pointId}:two:actions`, 0)
        await redisClient.set(`${gameId}:${pointId}:pulling`, isTeamOne(pullingTeam, 'one', 'two'))
        await redisClient.set(`${gameId}:${pointId}:receiving`, isTeamOne(pullingTeam, 'two', 'one'))
    }

    const isTeamOne = <T>(team: TeamNumber, value1: T, value2: T): T => {
        return team === TeamNumber.ONE ? value1 : value2
    }

    return {
        perform,
        helpers: {
            createNewPoint,
            setupRedisData,
            isTeamOne,
        },
    }
}

export type StartPoint = ReturnType<typeof startPoint>
