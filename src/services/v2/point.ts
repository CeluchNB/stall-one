import * as Constants from '../../utils/constants'
import { IActionModel } from '../../models/action'
import IGame from '../../types/game'
import { IGameModel } from '../../models/game'
import IPoint, { PointStatus } from '../../types/point'
import { IPointModel } from '../../models/point'
import { TeamNumber, TeamNumberString } from '../../types/ultmt'
import { authenticateManager } from '../../utils/ultmt'
import { findByIdOrThrow } from '../../utils/mongoose'
import { getRedisAction } from '../../utils/redis'
import { RedisAction, RedisClientType } from '../../types/action'
import { getTeamNumber } from '../../utils/game'
import PointServicesV1 from '../v1/point'
import { ApiError } from '../../types/errors'
import { handleCurrentPointUpdates } from '../../domains/point/next'
import { sendCloudTask } from '../../utils/cloud-tasks'

export default class PointServices {
    gameModel: IGameModel
    pointModel: IPointModel
    actionModel: IActionModel
    redisClient: RedisClientType
    ultmtUrl: string
    apiKey: string

    constructor(opts: {
        gameModel: IGameModel
        pointModel: IPointModel
        actionModel: IActionModel
        redisClient: RedisClientType
        ultmtUrl: string
        apiKey: string
    }) {
        this.gameModel = opts.gameModel
        this.pointModel = opts.pointModel
        this.actionModel = opts.actionModel
        this.redisClient = opts.redisClient
        this.ultmtUrl = opts.ultmtUrl
        this.apiKey = opts.apiKey
    }

    next = async (gameId: string, team: TeamNumber, pointId: string): Promise<IPoint> => {
        // verify score occurred
        const prevPoint = await handleCurrentPointUpdates(gameId, team, pointId)

        // finish current point
        await sendCloudTask(
            `/api/v1/point/${prevPoint._id}/background-finish`,
            {
                finishPointData: {
                    gameId,
                    team,
                },
            },
            'PUT',
        )

        const teamFilter =
            team === 'one' ? { teamTwoStatus: PointStatus.ACTIVE } : { teamTwoActive: PointStatus.ACTIVE }
        // find or create next point
        const nextPoint = await this.pointModel.findOneAndUpdate(
            { pointNumber: prevPoint.pointNumber + 1, gameId },
            teamFilter,
            { upsert: true },
        )

        return prevPoint
    }

    // back = async () => {}
}
