import * as Constants from '../../utils/constants'
import IPoint from '../../types/point'
import { IPointModel } from '../../models/point'
import { TeamNumber } from '../../types/ultmt'
import { sendCloudTask } from '../../utils/cloud-tasks'
import Dependencies from '../../types/di'
import { ApiError } from '../../types/errors'

export default class PointServices {
    pointModel: IPointModel
    finishPoint: Dependencies['finishPoint']
    startPoint: Dependencies['startPoint']
    backPoint: Dependencies['backPoint']

    constructor(opts: Dependencies) {
        this.pointModel = opts.pointModel
        this.finishPoint = opts.finishPoint
        this.startPoint = opts.startPoint
        this.backPoint = opts.backPoint
    }

    next = async (gameId: string, team: TeamNumber, pointNumber: number, pullingTeam: TeamNumber): Promise<IPoint> => {
        const currentPoint = await this.pointModel.findOne({ gameId, pointNumber })
        if (pointNumber > 0 && currentPoint) {
            await this.finishPoint.perform(gameId, team, currentPoint._id.toHexString())
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

        const point = await this.startPoint.perform(gameId, team, pointNumber, pullingTeam)

        return point
    }

    back = async (gameId: string, team: TeamNumber, pointNumber: number) => {
        const { point, actions } = await this.backPoint.perform(gameId, pointNumber, team)

        await sendCloudTask(
            `/api/v1/stats/point/${point._id}/delete`,
            {
                gameId,
            },
            'PUT',
        )

        return { point, actions }
    }
}
