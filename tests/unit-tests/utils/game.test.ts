import IGame, { CreateFullGame, GameStatus } from '../../../src/types/game'
import { Types } from 'mongoose'
import { getTeamNumber, getTeamTwoStatus } from '../../../src/utils/game'

describe('Game Utils', () => {
    describe('getTeamNumber', () => {
        it('with team one', () => {
            const teamOneId = new Types.ObjectId()
            const result = getTeamNumber({ teamOne: { _id: teamOneId } } as IGame, teamOneId.toHexString())
            expect(result).toBe('one')
        })

        it('with team two', () => {
            const teamTwoId = new Types.ObjectId()
            const result = getTeamNumber({ teamTwo: { _id: teamTwoId }, teamOne: {} } as IGame, teamTwoId.toHexString())
            expect(result).toBe('two')
        })

        it('with non team', () => {
            const teamTwoId = new Types.ObjectId()
            expect(() =>
                getTeamNumber(
                    { teamTwo: { _id: teamTwoId }, teamOne: {} } as IGame,
                    new Types.ObjectId().toHexString(),
                ),
            ).toThrow()
        })
    })

    describe('getTeamTwoStatus', () => {
        it('returns defined', () => {
            expect(getTeamTwoStatus({ teamTwo: { _id: 'test' } } as unknown as CreateFullGame)).toBe(GameStatus.DEFINED)
        })

        it('returns guest', () => {
            expect(getTeamTwoStatus({ teamTwo: { _id: undefined } } as unknown as CreateFullGame)).toBe(
                GameStatus.GUEST,
            )
        })
    })
})
