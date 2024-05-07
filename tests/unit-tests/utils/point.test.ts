import IGame, { GameStatus } from '../../../src/types/game'
import IPoint, { PointStatus } from '../../../src/types/point'
import { pointIsActive, pointIsComplete } from '../../../src/utils/point'

describe('Point Utils', () => {
    describe('pointIsComplete', () => {
        it('handles team one not complete', () => {
            const result = pointIsComplete({ teamOneStatus: PointStatus.ACTIVE } as IPoint, {} as IGame)
            expect(result).toBe(false)
        })

        it('handles both teams complete', () => {
            const result = pointIsComplete(
                { teamOneStatus: PointStatus.COMPLETE, teamTwoStatus: PointStatus.COMPLETE } as IPoint,
                {} as IGame,
            )
            expect(result).toBe(true)
        })

        it('handles team one complete and team two incomplete', () => {
            const result = pointIsComplete(
                { teamOneStatus: PointStatus.COMPLETE, teamTwoStatus: PointStatus.FUTURE } as IPoint,
                { teamTwoStatus: GameStatus.ACTIVE } as IGame,
            )
            expect(result).toBe(false)
        })

        it('handles team one complete and team two guest', () => {
            const result = pointIsComplete(
                { teamOneStatus: PointStatus.COMPLETE, teamTwoStatus: PointStatus.FUTURE } as IPoint,
                { teamTwoStatus: GameStatus.GUEST } as IGame,
            )
            expect(result).toBe(true)
        })
    })

    describe('pointIsActive', () => {
        it('returns true if team one is active', () => {
            const result = pointIsActive({
                teamOneStatus: PointStatus.ACTIVE,
                teamTwoStatus: PointStatus.FUTURE,
            } as IPoint)
            expect(result).toBe(true)
        })

        it('returns true if team two is active', () => {
            const result = pointIsActive({
                teamOneStatus: PointStatus.COMPLETE,
                teamTwoStatus: PointStatus.ACTIVE,
            } as IPoint)
            expect(result).toBe(true)
        })
        it('returns false if both teams are inactive', () => {
            const result = pointIsActive({
                teamOneStatus: PointStatus.COMPLETE,
                teamTwoStatus: PointStatus.FUTURE,
            } as IPoint)
            expect(result).toBe(false)
        })
    })
})
