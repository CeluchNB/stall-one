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

export function subscribe(channel: string, method: (message: string) => Promise<void>) {
    subClient.subscribe(channel, method)
}

export function publish(channel: string, data: string) {
    pubClient.publish(channel, data)
}
