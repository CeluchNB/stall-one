import { findByIdOrThrow, idsAreEqual } from '../../../src/utils/mongoose'
import Tournament from '../../../src/models/tournament'
import ITournament from '../../../src/types/tournament'
import { Types } from 'mongoose'
import { ApiError } from '../../../src/types/errors'
import { setUpDatabase, tearDownDatabase, resetDatabase } from '../../fixtures/setup-db'

beforeAll(async () => {
    await setUpDatabase()
})

afterAll(async () => {
    await tearDownDatabase()
})

afterEach(async () => {
    await resetDatabase()
})

describe('test find by id or throw', () => {
    it('with found document', async () => {
        const initTournament = await Tournament.create({
            name: 'Mid-Atlantic Reg 2022',
            startDate: new Date(),
            endDate: new Date(),
            eventId: 'mareg2022',
        })

        const tournament = await findByIdOrThrow<ITournament>(initTournament._id, Tournament, 'Cannot find tournament')

        expect(tournament.name).toBe('Mid-Atlantic Reg 2022')
        expect(tournament.eventId).toBe('mareg2022')
    })

    it('with unfound document', async () => {
        await expect(
            findByIdOrThrow<ITournament>(new Types.ObjectId(), Tournament, 'Cannot find tournament'),
        ).rejects.toThrowError(new ApiError('Cannot find tournament', 404))
    })
})

describe('ids are equal', () => {
    it('with undefined first value', () => {
        const id = new Types.ObjectId()
        expect(idsAreEqual(undefined, id)).toBe(false)
    })

    it('with undefined second value', () => {
        const id = new Types.ObjectId()
        expect(idsAreEqual(id, undefined)).toBe(false)
    })

    it('with equal values', () => {
        const id = new Types.ObjectId()
        const id2 = new Types.ObjectId(id)
        expect(idsAreEqual(id, id2)).toBe(true)
    })

    it('with unequal values', () => {
        const id = new Types.ObjectId()
        const id2 = new Types.ObjectId()
        expect(idsAreEqual(id, id2)).toBe(false)
    })
})
