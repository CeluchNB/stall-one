import * as Constants from '../../../../src/utils/constants'
import { setUpDatabase, tearDownDatabase, resetDatabase } from '../../../fixtures/setup-db'
import { CreateTournament } from '../../../../src/types/tournament'
import Tournament from '../../../../src/models/tournament'
import TournamentServices from '../../../../src/services/v1/tournament'
import { ApiError } from '../../../../src/types/errors'
import { Types } from 'mongoose'

beforeAll(async () => {
    await setUpDatabase()
})

afterAll(async () => {
    await tearDownDatabase()
})

afterEach(async () => {
    await resetDatabase()
})

const services = new TournamentServices(Tournament)
describe('test create tournament', () => {
    it('with valid data', async () => {
        const createData: CreateTournament = {
            startDate: new Date('09-22-2022'),
            endDate: new Date('09-23-2022'),
            name: 'Mid-Atlantic Regionals 2022',
            eventId: 'mareg22',
        }

        const tournament = await services.createTournament(createData)
        expect(tournament.startDate).toBe(createData.startDate)
        expect(tournament.endDate).toBe(createData.endDate)
        expect(tournament.name).toBe(createData.name)
        expect(tournament.eventId).toBe(createData.eventId)

        const tournamentRecord = await Tournament.findById(tournament._id)
        expect(tournamentRecord?.eventId).toBe(createData.eventId)
    })

    it('with extra data', async () => {
        const createData = {
            startDate: new Date('09-22-2022'),
            endDate: new Date('09-23-2022'),
            name: 'Mid-Atlantic Regionals 2022',
            eventId: 'mareg22',
            some: 'baddata',
        }
        const tournament = await services.createTournament(createData as unknown as CreateTournament)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((tournament as any).some).toBeUndefined()

        const tournamentRecord = await Tournament.findById(tournament._id)
        expect(tournamentRecord?.eventId).toBe(createData.eventId)
    })
})

describe('test get tournament', () => {
    it('with existing tournament', async () => {
        const createData: CreateTournament = {
            startDate: new Date('09-22-2022'),
            endDate: new Date('09-23-2022'),
            name: 'Mid-Atlantic Regionals 2022',
            eventId: 'mareg22',
        }
        const initTournament = await Tournament.create(createData)

        const tournament = await services.getTournament(initTournament._id.toString())
        expect(tournament.eventId).toBe(createData.eventId)
    })

    it('with unfound tournament', async () => {
        await expect(services.getTournament(new Types.ObjectId().toString())).rejects.toThrowError(
            new ApiError(Constants.UNABLE_TO_FIND_TOURNAMENT, 404),
        )
    })
})

describe('test search tournaments', () => {
    beforeEach(async () => {
        await Tournament.create({
            name: 'Mid-Atlantic Regionals 2022',
            eventId: 'mareg22',
        })

        await Tournament.create({
            startDate: new Date('09-29-2022'),
            endDate: new Date('09-30-2022'),
            name: 'Great Lakes Mens Regionals 2022',
            eventId: 'glmenreg2022',
        })

        await Tournament.create({
            startDate: new Date('09-22-2022'),
            endDate: new Date('09-23-2022'),
            name: 'Southwest Womens Regionals 2022',
            eventId: 'swwomenreg22',
        })
    })

    it('finding all tournaments', async () => {
        const tournaments = await services.searchTournaments('Regionals')
        expect(tournaments.length).toBe(3)
        expect(tournaments[0].eventId).toBe('glmenreg2022')
        expect(tournaments[1].eventId).toBe('swwomenreg22')
        expect(tournaments[2].eventId).toBe('mareg22')
    })

    it('finding one tournament by name', async () => {
        const tournaments = await services.searchTournaments('Womens')
        expect(tournaments.length).toBe(1)
    })

    it('finding one tournament by event id', async () => {
        const tournaments = await services.searchTournaments('mareg22')
        expect(tournaments.length).toBe(1)
    })

    it('finding no tournaments', async () => {
        const tournaments = await services.searchTournaments('random text')
        expect(tournaments.length).toBe(0)
    })
})
