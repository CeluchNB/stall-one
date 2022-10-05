import * as Constants from '../../../src/utils/constants'
import app, { close } from '../../../src/app'
import request from 'supertest'
import { resetDatabase } from '../../fixtures/setup-db'
import { CreateTournament } from '../../../src/types/tournament'
import Tournament from '../../../src/models/tournament'
import { Types } from 'mongoose'
import { ApiError } from '../../../src/types/errors'

afterAll(async () => {
    await close()
})

afterEach(async () => {
    await resetDatabase()
})

describe('test /POST tournament', () => {
    it('with valid data', async () => {
        const createTournamentData: CreateTournament = {
            name: 'Mid-Atlantic Regionals 2022',
            eventId: 'mareg22',
            startDate: new Date('09-22-2022'),
            endDate: new Date('09-23-2022'),
        }

        const response = await request(app).post('/api/v1/tournament').send({ createTournamentData }).expect(201)
        const { tournament } = response.body
        expect(tournament._id).toBeDefined()
        expect(tournament.name).toBe(createTournamentData.name)
        expect(tournament.eventId).toBe(createTournamentData.eventId)
        expect(new Date(tournament.startDate)).toEqual(createTournamentData.startDate)
        expect(new Date(tournament.endDate)).toEqual(createTournamentData.endDate)

        const tournamentRecord = await Tournament.findById(tournament._id)
        expect(tournamentRecord?.eventId).toBe(createTournamentData.eventId)
    })

    it('with bad data', async () => {
        const createTournamentData = {
            eventId: 'mareg22',
            startDate: new Date('09-22-2022'),
            endDate: new Date('09-23-2022'),
        }
        const response = await request(app).post('/api/v1/tournament').send({ createTournamentData }).expect(500)
        expect(response.body.message).toBe(Constants.GENERIC_ERROR)
    })
})

describe('test /GET tournament', () => {
    it('with existing tournament', async () => {
        const createTournamentData: CreateTournament = {
            name: 'Mid-Atlantic Regionals 2022',
            eventId: 'mareg22',
            startDate: new Date('09-22-2022'),
            endDate: new Date('09-23-2022'),
        }
        const seedTourney = await Tournament.create(createTournamentData)

        const response = await request(app).get(`/api/v1/tournament/${seedTourney._id.toString()}`).send().expect(200)
        const { tournament } = response.body
        expect(tournament._id.toString()).toBe(seedTourney._id.toString())
        expect(tournament.eventId).toBe(createTournamentData.eventId)
        expect(tournament.name).toBe(createTournamentData.name)
        expect(new Date(tournament.startDate)).toEqual(createTournamentData.startDate)
        expect(new Date(tournament.endDate)).toEqual(createTournamentData.endDate)
    })

    it('with unfound tournament', async () => {
        const response = await request(app)
            .get(`/api/v1/tournament/${new Types.ObjectId().toString()}`)
            .send()
            .expect(404)

        expect(response.body.message).toBe(Constants.UNABLE_TO_FIND_TOURNAMENT)
    })
})

describe('test /GET search tournaments', () => {
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

    it('finding multiple tournaments', async () => {
        const response = await request(app).get('/api/v1/tournament/search?q=Regionals').send().expect(200)

        const { tournaments } = response.body
        expect(tournaments.length).toBe(3)

        expect(tournaments[0].eventId).toBe('glmenreg2022')
        expect(tournaments[1].eventId).toBe('swwomenreg22')
        expect(tournaments[2].eventId).toBe('mareg22')
    })

    it('with an error', async () => {
        jest.spyOn(Tournament, 'find').mockImplementationOnce(() => {
            throw new ApiError(Constants.GENERIC_ERROR, 500)
        })
        const response = await request(app)
            .get('/api/v1/tournament/search?q=somebaddataforsomereason')
            .send()
            .expect(500)

        expect(response.body.message).toBe(Constants.GENERIC_ERROR)
    })
})
