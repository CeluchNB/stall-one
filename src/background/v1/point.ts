import Action from '../../models/action'
import Game from '../../models/game'
import Point from '../../models/point'
import PointBackgroundServices from '../../services/v1/point-background'
import { connection } from '../../loaders/bullmq'
import { Queue, Worker } from 'bullmq'
import { TeamNumber } from '../../types/ultmt'

const FINISH_POINT_QUEUE = 'FinishPoint'

const services = new PointBackgroundServices(Point, Game, Action)

export const queue = new Queue(FINISH_POINT_QUEUE, { connection })
export const worker = new Worker(FINISH_POINT_QUEUE, services.finishPoint, { connection })

export const addFinishPointJob = async (data: { gameId: string; pointId: string; team: TeamNumber }) => {
    const { gameId, pointId, team } = data
    await queue.add(pointId, { gameId, pointId, team })
}
