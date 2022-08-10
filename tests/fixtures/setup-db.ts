import { connect, connection, Types } from 'mongoose'
import { CreateGame } from '../../src/types/game'
import Game from '../../src/models/game'

export const setUpDatabase = async () => {
    await connect(process.env.MONGOOSE_URL as string)
}

export const resetDatabase = async () => {
    await Game.deleteMany({})
}

export const tearDownDatabase = () => {
    connection.close()
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

export const fetchMock = jest.fn((url) => {
    if (url.includes('manager/authenticate')) {
        return Promise.resolve({
            json: () =>
                Promise.resolve({
                    user: {
                        _id: new Types.ObjectId(),
                        firstName: 'first',
                        lastName: 'last',
                        username: 'firstlast',
                    },
                }),
            ok: true,
            status: 200,
        })
    } else if (url.includes('v1/team')) {
        return Promise.resolve({
            json: () =>
                Promise.resolve({
                    team: {
                        _id: new Types.ObjectId(),
                        players: [
                            {
                                _id: new Types.ObjectId(),
                                firstName: 'player 1',
                                lastName: 'last 1',
                                username: 'player1',
                            },
                            {
                                _id: new Types.ObjectId(),
                                firstName: 'player 2',
                                lastName: 'last 2',
                                username: 'player2',
                            },
                        ],
                    },
                }),
            ok: true,
            status: 200,
        })
    }
}) as jest.Mock
