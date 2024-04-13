import * as Constants from '../../../utils/constants'
import { ActionType, RedisAction } from '../../../types/action'
import { ApiError } from '../../../types/errors'
import { Team, TeamNumber } from '../../../types/ultmt'
import { getRedisAction } from '../../../utils/redis'
import { findByIdOrThrow } from '../../../utils/mongoose'
import IPoint, { PointStatus } from '../../../types/point'
import IGame from '../../../types/game'
import { Document } from 'mongoose'
import Dependencies from '../../../types/di'

export const finishPoint = ({ gameModel, pointModel, actionModel, redisClient }: Dependencies) => {
    const perform = async (gameId: string, team: TeamNumber, pointId: string): Promise<IPoint> => {
        const point = await findByIdOrThrow<IPoint>(pointId, pointModel, Constants.UNABLE_TO_FIND_POINT)
        const game = await findByIdOrThrow<IGame>(gameId, gameModel, Constants.UNABLE_TO_FIND_GAME)

        await handleTeamScoreReport(game, team, point)
        completePoint(point, team)
        await point.save()

        updateGameScore(game, point)
        await game.save()

        return point
    }

    const handleTeamScoreReport = async (
        game: IGame,
        team: TeamNumber,
        point: Document<unknown, unknown, IPoint> & IPoint,
    ) => {
        const totalActions = await redisClient.get(
            `${game._id.toHexString()}:${point._id.toHexString()}:${team}:actions`,
        )
        const lastAction = await getRedisAction(redisClient, point._id.toHexString(), Number(totalActions), team)

        const teamOneFirstReporting = team === 'one' && point.teamTwoStatus !== PointStatus.COMPLETE
        const teamTwoFirstReporting = team === 'two' && point.teamOneStatus !== PointStatus.COMPLETE

        // first team to submit updates point
        if (teamOneFirstReporting || teamTwoFirstReporting) {
            await updatePointScore(point, lastAction, game)
        } else {
            // check for conflict on second team reporting
            await throwIfConflictingScore(game, team, point, lastAction)
        }
        return point
    }

    const updatePointScore = async (
        point: Document<unknown, unknown, IPoint> & IPoint,
        lastAction: RedisAction,
        game: IGame,
    ) => {
        const prevPoint = await pointModel.findOne({ gameId: point.gameId, pointNumber: point.pointNumber - 1 })
        if (lastAction.actionType === ActionType.TEAM_ONE_SCORE) {
            point.teamOneScore = (prevPoint?.teamOneScore ?? 0) + 1
            point.scoringTeam = game.teamOne
        } else if (lastAction.actionType === ActionType.TEAM_TWO_SCORE) {
            point.teamTwoScore = (prevPoint?.teamTwoScore ?? 0) + 1
            point.scoringTeam = game.teamTwo
        } else {
            throw new ApiError(Constants.SCORE_REQUIRED, 400)
        }
    }

    const throwIfConflictingScore = async (game: IGame, team: TeamNumber, point: IPoint, lastAction: RedisAction) => {
        const liveConflict = await checkConflictingLiveScore(
            game._id.toHexString(),
            team,
            point._id.toHexString(),
            lastAction,
        )
        const savedConflict = await checkConflictingSavedScore(
            point._id.toHexString(),
            team === 'one' ? game.teamTwo : game.teamOne,
            lastAction,
        )
        if (liveConflict || savedConflict) {
            throw new ApiError(Constants.CONFLICTING_SCORE, 400)
        }
    }

    const checkConflictingLiveScore = async (
        gameId: string,
        team: TeamNumber,
        pointId: string,
        myLastAction: RedisAction,
    ) => {
        const otherTeam = team === 'one' ? 'two' : 'one'
        const otherTeamTotalActions = await redisClient.get(`${gameId}:${pointId}:${otherTeam}:actions`)
        if (!otherTeamTotalActions || Number(otherTeamTotalActions) === 0) return false

        const otherTeamLastAction = await getRedisAction(redisClient, pointId, Number(otherTeamTotalActions), otherTeam)
        if (!otherTeamLastAction.actionType) return false

        return otherTeamLastAction.actionType !== myLastAction.actionType
    }

    const checkConflictingSavedScore = async (pointId: string, team: Team, lastAction: RedisAction) => {
        if (!team?._id) return false

        const reportedScore = await actionModel.findOne({ pointId, 'team._id': team._id }).sort('-actionNumber')
        return !!reportedScore && reportedScore.actionType !== lastAction.actionType
    }

    const updateGameScore = (game: IGame, point: IPoint) => {
        game.teamOneScore = point.teamOneScore
        game.teamTwoScore = point.teamTwoScore
    }

    const completePoint = (point: IPoint, team: TeamNumber) => {
        if (team === 'one') {
            point.teamOneStatus = PointStatus.COMPLETE
        } else if (team === 'two') {
            point.teamTwoStatus = PointStatus.COMPLETE
        }
    }

    return {
        perform,
        helpers: {
            handleTeamScoreReport,
            updatePointScore,
            throwIfConflictingScore,
            checkConflictingLiveScore,
            checkConflictingSavedScore,
            updateGameScore,
            completePoint,
        },
    }
}

export type FinishPoint = ReturnType<typeof finishPoint>
