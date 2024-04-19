import IGame, { GameStatus } from '../../../src/types/game'
import IPoint, { PointStatus } from '../../../src/types/point'
import { pointIsComplete } from '../../../src/utils/point'

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
})
