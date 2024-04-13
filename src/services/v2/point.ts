import { IActionModel } from '../../models/action'
import { IGameModel } from '../../models/game'
import IPoint from '../../types/point'
import { IPointModel } from '../../models/point'
import { TeamNumber } from '../../types/ultmt'
import { RedisClientType } from '../../types/action'
import { sendCloudTask } from '../../utils/cloud-tasks'
import { container } from '../../di'
import Dependencies from '../../types/di'

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
        const { perform: finishPoint }: Dependencies['finishPoint'] = container.resolve('finishPoint')
        const prevPoint = await finishPoint(gameId, team, pointId)

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

        // const teamFilter =
        //     team === 'one' ? { teamTwoStatus: PointStatus.ACTIVE } : { teamTwoActive: PointStatus.ACTIVE }
        // find or create next point
        // const nextPoint = await this.pointModel.findOneAndUpdate(
        //     { pointNumber: prevPoint.pointNumber + 1, gameId },
        //     teamFilter,
        //     { upsert: true },
        // )

        return prevPoint
    }

    // back = async () => {}
}
