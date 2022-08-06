import { connect, connection, Types } from 'mongoose'
import { CreateGame } from '../../src/types/game'
import Game from '../../src/models/game'

export const setUpDatabase = async () => {
    await connect(process.env.MONGOOSE_URL as string)
}

export const resetDatabase = async () => {
    await Game.deleteMany({})
}

export const createData: CreateGame = {
    teamOne: {
        _id: new Types.ObjectId(),
        place: 'Place1',
        name: 'Name1',
        teamname: 'Place1Name1',
        seasonStart: new Date(),
        seasonEnd: new Date(),
    },
    teamTwo: {
        name: 'Name2',
    },
    teamTwoResolved: false,
    scoreLimit: 15,
    startTime: new Date(),
    softcapMins: 75,
    hardcapMins: 90,
    liveGame: true,
    playersPerPoint: 7,
    timeoutPerHalf: 1,
    floaterTimeout: true,
}

export const tearDownDatabase = () => {
    connection.close()
}
