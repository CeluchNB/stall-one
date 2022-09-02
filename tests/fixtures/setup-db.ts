import { connect, connection, Types } from 'mongoose'
import { createClient } from 'redis'
import IGame, { CreateGame } from '../../src/types/game'
import IPoint from '../../src/types/point'
import Game from '../../src/models/game'
import jwt from 'jsonwebtoken'
import Point from '../../src/models/point'
import Action from '../../src/models/action'

export const client = createClient()
export const setUpDatabase = async () => {
    await connect(process.env.MONGOOSE_URL as string)
    await client.connect()
}

export const resetDatabase = async () => {
    await Game.deleteMany({})
    await Point.deleteMany({})
    await Action.deleteMany({})
    if (client.isOpen) {
        await client.flushAll()
    }
}

export const tearDownDatabase = () => {
    connection.close()
    client.quit()
}

export const createData: CreateGame = {
    creator: {
        _id: new Types.ObjectId(),
        firstName: 'First1',
        lastName: 'Last1',
        username: 'first1last1',
    },
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
    teamTwoDefined: false,
    scoreLimit: 15,
    halfScore: 8,
    startTime: new Date(),
    softcapMins: 75,
    hardcapMins: 90,
    liveGame: true,
    playersPerPoint: 7,
    timeoutPerHalf: 1,
    floaterTimeout: true,
}

const gameId = new Types.ObjectId()
export const gameData: IGame = {
    _id: gameId,
    ...createData,
    teamOnePlayers: [],
    teamTwoPlayers: [],
    creator: { firstName: 'first', lastName: 'last', _id: new Types.ObjectId(), username: 'firstlast' },
    teamOneToken: jwt.sign({ sub: gameId, iat: 657483, team: 'one' }, process.env.JWT_SECRET as string),
    teamTwoToken: undefined,
    teamOneScore: 0,
    teamTwoScore: 0,
    teamTwoResolved: false,
    resolveCode: '123456',
    completeGame: false,
}

const pointId = new Types.ObjectId()
export const createPointData: IPoint = {
    _id: pointId,
    gameId: gameId,
    pointNumber: 1,
    teamOnePlayers: [],
    teamTwoPlayers: [],
    teamOneScore: 0,
    teamTwoScore: 0,
    pullingTeam: {
        _id: new Types.ObjectId(),
        place: 'Place1',
        name: 'Name1',
        teamname: 'Place1Name1',
        seasonStart: new Date(),
        seasonEnd: new Date(),
    },
    receivingTeam: {
        name: 'Name2',
    },
}

export const getMock = jest.fn((url) => {
    if (url.includes('manager/authenticate')) {
        return Promise.resolve({
            data: {
                user: {
                    _id: new Types.ObjectId(),
                    firstName: 'first',
                    lastName: 'last',
                    username: 'firstlast',
                },
            },
            ok: true,
            status: 200,
        })
    } else if (url.includes('v1/team')) {
        return Promise.resolve({
            data: {
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
            },
            ok: true,
            status: 200,
        })
    }
}) as jest.Mock
