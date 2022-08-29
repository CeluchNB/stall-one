import { createClient } from 'redis'
import { createAdapter } from '@socket.io/redis-adapter'

export async function createRedisAdapter() {
    const pubClient = createClient({ url: process.env.REDIS_URL })
    const subClient = pubClient.duplicate()

    await pubClient.connect()
    await subClient.connect()

    return createAdapter(pubClient, subClient)
}
