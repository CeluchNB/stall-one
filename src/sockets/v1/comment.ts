import { Comment } from '../../types/action'

const commentHandler = (data: Comment) => {
    console.log('got a comment', data)
    // save to redis
    // send data (full point) to users
    // save to mongodb
}

export default commentHandler
