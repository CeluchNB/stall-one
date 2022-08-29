import { ClientAction } from '../../types/action'

const actionHandler = (data: ClientAction) => {
    console.log('data', data)
    // handle logic for action type
    // save to redis
    // propagate data to users
    // save to mongo
}

export default actionHandler
