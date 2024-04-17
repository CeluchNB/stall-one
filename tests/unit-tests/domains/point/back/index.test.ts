import * as Constants from '../../../../../src/utils/constants'
import { Types } from 'mongoose'
import { container } from '../../../../../src/di'
import Game from '../../../../../src/models/game'
import Point from '../../../../../src/models/point'
import Dependencies from '../../../../../src/types/di'
import IPoint, { PointStatus } from '../../../../../src/types/point'
import {
    setUpDatabase,
    tearDownDatabase,
    resetDatabase,
    createPointData,
    gameData,
} from '../../../../fixtures/setup-db'
import { client } from '../../../../../src/utils/redis'

beforeAll(async () => {
    client.connect()
    await setUpDatabase()
})

beforeEach(async () => {
    await resetDatabase()
})

afterAll(async () => {
    await tearDownDatabase()
    client.quit()
})

describe('Back Point', () => {
    let backPoint: Dependencies['backPoint']
    beforeAll(() => {
        backPoint = container.resolve('backPoint')
    })

    describe('helpers', () => {
        describe('findPointByGameAndNumber', () => {
            let findPointByGameAndNumber: Dependencies['backPoint']['helpers']['findPointByGameAndNumber']
            beforeAll(() => {
                findPointByGameAndNumber = backPoint.helpers.findPointByGameAndNumber
            })

            it('returns found point', async () => {
                const point = await Point.create(createPointData)
                const result = await findPointByGameAndNumber(point.gameId.toHexString(), point.pointNumber)
                expect(result._id.toHexString()).toBe(point._id.toHexString())
            })

            it('throws error on unfound point', async () => {
                await expect(findPointByGameAndNumber(new Types.ObjectId().toHexString(), 2)).rejects.toThrow(
                    Constants.UNABLE_TO_FIND_POINT,
                )
            })
        })

        describe('validatePointStatus', () => {
            let validatePointStatus: Dependencies['backPoint']['helpers']['validatePointStatus']
            beforeAll(() => {
                validatePointStatus = backPoint.helpers.validatePointStatus
            })

            it('resolves when status matches', () => {
                expect(() => {
                    validatePointStatus(
                        { teamOneStatus: PointStatus.ACTIVE } as IPoint,
                        'teamOneStatus',
                        PointStatus.ACTIVE,
                    )
                }).not.toThrow()
            })

            it('throws when status does not match', () => {
                expect(() => {
                    validatePointStatus(
                        { teamOneStatus: PointStatus.COMPLETE } as IPoint,
                        'teamOneStatus',
                        PointStatus.ACTIVE,
                    )
                }).toThrow(Constants.CANNOT_GO_BACK_POINT)
            })
        })

        describe('pointIsInactive', () => {
            let pointIsInactive: Dependencies['backPoint']['helpers']['pointIsInactive']
            beforeAll(() => {
                pointIsInactive = backPoint.helpers.pointIsInactive
            })

            it('returns false if team one is active', () => {
                const point = { teamOneStatus: PointStatus.ACTIVE, teamTwoStatus: PointStatus.FUTURE }
                expect(pointIsInactive(point as IPoint)).toBe(false)
            })

            it('returns false if team two is active', () => {
                const point = { teamOneStatus: PointStatus.COMPLETE, teamTwoStatus: PointStatus.ACTIVE }
                expect(pointIsInactive(point as IPoint)).toBe(false)
            })

            it('returns true if both teams are inactive', () => {
                const point = { teamOneStatus: PointStatus.COMPLETE, teamTwoStatus: PointStatus.FUTURE }
                expect(pointIsInactive(point as IPoint)).toBe(true)
            })
        })

        describe('updateScores', () => {
            let updateScores: Dependencies['backPoint']['helpers']['updateScores']
            beforeAll(() => {
                updateScores = backPoint.helpers.updateScores
            })

            it('updats scores', async () => {
                const game = await Game.create({ ...gameData, teamOneScore: 0, teamTwoScore: 0 })
                const point1 = await Point.create({ ...createPointData, teamOneScore: 0, teamTwoScore: 0 })
                const point2 = await Point.create({
                    ...createPointData,
                    _id: new Types.ObjectId(),
                    teamOneScore: 5,
                    teamTwoScore: 4,
                })

                updateScores(point1, game, point2)
                expect(game).toMatchObject({ teamOneScore: 5, teamTwoScore: 4 })
                expect(point1).toMatchObject({ teamOneScore: 5, teamTwoScore: 4 })
            })
        })
    })
})
