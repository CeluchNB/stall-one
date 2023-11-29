import { createClient } from 'redis'
import { createAdapter } from '@socket.io/redis-adapter'

const pubClient = createClient({ url: process.env.REDIS_URL })
const subClient = pubClient.duplicate()

export async function createRedisAdapter() {
    await pubClient.connect()
    await subClient.connect()

    return createAdapter(pubClient, subClient)
}

export async function closeRedisConnection() {
    if (pubClient.isOpen) {
        await pubClient.quit()
    }
    if (subClient.isOpen) {
        await subClient.quit()
    }
}
