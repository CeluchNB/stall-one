import * as Constants from '../../utils/constants'
import { IActionModel } from '../../models/action'
import { IGameModel } from '../../models/game'
import IPoint from '../../types/point'
import { IPointModel } from '../../models/point'
import { TeamNumber } from '../../types/ultmt'
import { RedisClientType } from '../../types/action'
import { sendCloudTask } from '../../utils/cloud-tasks'
import { container } from '../../di'
import Dependencies from '../../types/di'
import { ApiError } from '../../types/errors'

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

    next = async (gameId: string, team: TeamNumber, pointNumber: number, pullingTeam: TeamNumber): Promise<IPoint> => {
        const currentPoint = await this.pointModel.findOne({ gameId, pointNumber })
        if (pointNumber > 0 && currentPoint) {
            const { perform: finishPoint }: Dependencies['finishPoint'] = container.resolve('finishPoint')
            await finishPoint(gameId, team, currentPoint._id.toHexString())
            // finish current point
            await sendCloudTask(
                `/api/v1/point/${currentPoint._id}/background-finish`,
                {
                    finishPointData: {
                        gameId,
                        team,
                    },
                },
                'PUT',
            )
        } else if (pointNumber > 0 && !currentPoint) {
            throw new ApiError(Constants.UNABLE_TO_FIND_POINT, 404)
        }

        const { perform: startPoint }: Dependencies['startPoint'] = container.resolve('startPoint')
        const point = await startPoint(gameId, team, pointNumber, pullingTeam)

        return point
    }

    // back = async () => {}
}
