/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as Constants from '../../../../src/utils/constants'
import Action from '../../../../src/models/action'
import Game from '../../../../src/models/game'
import Point from '../../../../src/models/point'
import GameServices from '../../../../src/services/v2/game'
import axios from 'axios'
import { setUpDatabase, tearDownDatabase, client, getMock, resetDatabase } from '../../../fixtures/setup-db'
import { Types } from 'mongoose'
import { getRedisAction, saveRedisAction } from '../../../../src/utils/redis'
import { ActionType } from '../../../../src/types/action'

const services = new GameServices(Game, Point, Action, client, '', '')

beforeEach(() => {
    jest.spyOn(axios, 'get').mockImplementation(getMock)
})

afterEach(() => {
    jest.spyOn(axios, 'get').mockReset()
})

beforeAll(async () => {
    await setUpDatabase()
})

afterAll(async () => {
    await tearDownDatabase()
})

afterEach(async () => {
    await resetDatabase()
})

describe('Game Services v2', () => {
    describe('reactivate game', () => {
        const teamOne = {
            _id: new Types.ObjectId(),
            name: 'Team One',
            place: 'Place One',
            teamname: 'team1',
        }
        const teamTwo = {
            _id: new Types.ObjectId(),
            name: 'Team Two',
            place: 'Place Two',
            teamname: 'team2',
        }

        const gameId = new Types.ObjectId()
        beforeEach(async () => {
            const action11 = await Action.create({
                team: teamOne,
                actionNumber: 1,
                actionType: 'Catch',
            })
            const action12 = await Action.create({
                team: teamOne,
                actionNumber: 2,
                actionType: 'Catch',
            })
            const action13 = await Action.create({
                team: teamOne,
                actionNumber: 3,
                actionType: 'TeamOneScore',
            })

            const action21 = await Action.create({
                team: teamTwo,
                actionNumber: 1,
                actionType: 'Pull',
            })
            const action22 = await Action.create({
                team: teamTwo,
                actionNumber: 2,
                actionType: 'TeamOneScore',
            })

            const point1 = await Point.create({
                pointNumber: 1,
                teamOneScore: 1,
                teamTwoScore: 0,
                pullingTeam: teamTwo,
                receivingTeam: teamOne,
                scoringTeam: teamOne,
                teamOneActive: false,
                teamTwoActive: false,
                teamOneActions: [action11._id, action12._id, action13._id],
                teamTwoActions: [action21._id, action22._id],
            })

            const point2 = await Point.create({
                pointNumber: 2,
                teamOneScore: 1,
                teamTwoScore: 0,
                pullingTeam: teamTwo,
                receivingTeam: teamOne,
                scoringTeam: undefined,
                teamOneActive: true,
                teamTwoActive: true,
                teamOneActions: [],
                teamTwoActions: [],
            })

            await saveRedisAction(
                client,
                { teamNumber: 'one', actionNumber: 1, actionType: ActionType.PULL, comments: [], tags: [] },
                point2._id.toHexString(),
            )

            await client.set(`${gameId}:${point2._id}:one:actions`, 1)

            await saveRedisAction(
                client,
                { teamNumber: 'two', actionNumber: 1, actionType: ActionType.CATCH, comments: [], tags: [] },
                point2._id.toHexString(),
            )

            await saveRedisAction(
                client,
                { teamNumber: 'two', actionNumber: 2, actionType: ActionType.CATCH, comments: [], tags: [] },
                point2._id.toHexString(),
            )

            await client.set(`${gameId}:${point2._id}:two:actions`, 2)

            await Game.create({
                _id: gameId,
                teamOne,
                teamTwo,
                teamTwoDefined: true,
                teamTwoActive: false,
                teamOneActive: false,
                scoreLimit: 15,
                halfScore: 8,
                startTime: new Date(),
                softcapMins: 75,
                hardcapMins: 90,
                playersPerPoint: 7,
                timeoutPerHalf: 1,
                floaterTimeout: true,
                points: [point1._id, point2._id],
            })
        })

        it('reactivates for team one', async () => {
            const res = {
                writeHead: jest.fn(),
                write: jest.fn(),
                end: jest.fn(),
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await services.reactivateGame(gameId.toHexString(), 'jwt', teamOne._id.toHexString(), res as any)

            const game = await Game.findOne({})
            expect(game?.teamOneActive).toBe(true)
            expect(game?.teamTwoActive).toBe(false)

            expect(res.writeHead).toHaveBeenCalledTimes(1)
            expect(res.write).toHaveBeenCalledTimes(18)

            const gameResponse = JSON.parse(res.write.mock.calls[2][0])
            expect(gameResponse._id).toBe(game!._id.toHexString())

            const tokenWrite = res.write.mock.calls[4][0]
            expect(tokenWrite).toMatch(/"token":/)

            const pointOne = await Point.findOne({ pointNumber: 1 })
            expect(JSON.parse(res.write.mock.calls[7][0])).toMatchObject(pointOne!.toJSON())

            const actionsOne = (await Action.find({ 'team._id': teamOne._id })).map((action) => action.toJSON())
            expect(JSON.parse(res.write.mock.calls[9][0])).toMatchObject(actionsOne)

            const pointTwo = await Point.findOne({ pointNumber: 2 })
            expect(JSON.parse(res.write.mock.calls[13][0])).toMatchObject(pointTwo!.toJSON())

            const actionsTwo = await Promise.all([getRedisAction(client, pointTwo!._id.toHexString(), 1, 'one')])
            expect(actionsTwo).toMatchObject(JSON.parse(res.write.mock.calls[15][0]))

            expect(res.end).toHaveBeenCalledTimes(1)
        })

        it('reactivates for team two', async () => {
            const res = {
                writeHead: jest.fn(),
                write: jest.fn(),
                end: jest.fn(),
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await services.reactivateGame(gameId.toHexString(), 'jwt', teamTwo._id.toHexString(), res as any)

            const game = await Game.findOne({})
            expect(game?.teamOneActive).toBe(false)
            expect(game?.teamTwoActive).toBe(true)

            expect(res.write).toHaveBeenCalledTimes(18)

            const gameResponse = JSON.parse(res.write.mock.calls[2][0])
            expect(gameResponse._id).toBe(game!._id.toHexString())

            const tokenWrite = res.write.mock.calls[4][0]
            expect(tokenWrite).toMatch(/"token":/)

            const pointOne = await Point.findOne({ pointNumber: 1 })
            expect(JSON.parse(res.write.mock.calls[7][0])).toMatchObject(pointOne!.toJSON())

            const actionsOne = (await Action.find({ 'team._id': teamTwo._id })).map((action) => action.toJSON())
            expect(JSON.parse(res.write.mock.calls[9][0])).toMatchObject(actionsOne)

            const pointTwo = await Point.findOne({ pointNumber: 2 })
            expect(JSON.parse(res.write.mock.calls[13][0])).toMatchObject(pointTwo!.toJSON())

            const actionsTwo = await Promise.all([
                getRedisAction(client, pointTwo!._id.toHexString(), 1, 'two'),
                getRedisAction(client, pointTwo!._id.toHexString(), 2, 'two'),
            ])
            expect(actionsTwo).toMatchObject(JSON.parse(res.write.mock.calls[15][0]))

            expect(res.end).toHaveBeenCalledTimes(1)
        })

        it('handles error', async () => {
            const res = {
                write: jest.fn(),
                end: jest.fn(),
            }

            const badId = new Types.ObjectId()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await services.reactivateGame(gameId.toHexString(), 'jwt', badId.toHexString(), res as any)

            expect(res.write).toHaveBeenCalledTimes(1)
            expect(JSON.parse(res.write.mock.calls[0][0]).error).toMatch(Constants.GENERIC_ERROR)
            expect(res.end).toHaveBeenCalledTimes(1)
        })
    })
})
