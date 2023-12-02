import Action from '../../models/action'
import IORedis from 'ioredis'
import Game from '../../models/game'
import Point from '../../models/point'
import PointBackgroundServices from '../../services/v1/point-background'
import { Queue, Worker } from 'bullmq'
import { TeamNumber } from '../../types/ultmt'

const FINISH_POINT_QUEUE = 'FinishPoint'

const FinishPointQueue = () => {
    const services = new PointBackgroundServices(Point, Game, Action)

    let connection: IORedis
    let queue: Queue
    let worker: Worker

    const initializeConnection = () => {
        connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null })
    }

    const initializeQueue = () => {
        queue = new Queue(FINISH_POINT_QUEUE, { connection })
    }

    const initializeWorker = () => {
        worker = new Worker(FINISH_POINT_QUEUE, services.finishPoint, { connection })
    }

    const initialize = () => {
        initializeConnection()
        initializeQueue()
        initializeWorker()
    }

    const closeQueue = async () => {
        await queue.close()
    }

    const closeWorker = async () => {
        await worker.close()
    }

    const closeConnection = async () => {
        await connection.quit()
    }

    const close = async () => {
        await closeWorker()
        await closeQueue()
        await closeConnection()
    }

    const addFinishPointJob = async (data: { gameId: string; pointId: string; team: TeamNumber }) => {
        const { gameId, pointId, team } = data
        await queue.add(pointId, { gameId, pointId, team })
    }

    return {
        initializeQueue,
        initializeWorker,
        initializeConnection,
        closeQueue,
        closeWorker,
        closeConnection,
        initialize,
        close,
        addFinishPointJob,
    }
}

export const finishPointQueue = FinishPointQueue()
