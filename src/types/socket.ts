import { ClientAction, Comment } from './action'

export interface ClientToServerEvents {
    action: (data: ClientAction) => void
    comment: (data: Comment) => void
}
