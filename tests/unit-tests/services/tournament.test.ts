import { setUpDatabase, tearDownDatabase, resetDatabase } from '../../fixtures/setup-db'
import { CreateTournament } from '../../../src/types/tournament'
import Tournament from '../../../src/models/tournament'
import TournamentServices from '../../../src/services/v1/tournament'

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
