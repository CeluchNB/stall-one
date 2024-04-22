import * as UltmtUtils from '../../../../../src/utils/ultmt'
import { container } from '../../../../../src/di'
import Dependencies from '../../../../../src/types/di'
import { setUpDatabase, tearDownDatabase, resetDatabase, gameData } from '../../../../fixtures/setup-db'
import { client } from '../../../../../src/utils/redis'
import { GameStatus } from '../../../../../src/types/game'
import { Types } from 'mongoose'
import Tournament from '../../../../../src/models/tournament'

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

describe('Create Full Game', () => {
    let fullGame: Dependencies['fullGame']
    beforeAll(() => {
        fullGame = container.resolve('fullGame')
    })
    describe('perform', () => {
        it('works', () => {
            expect(1 + 1).toBe(2)
        })
    })

    describe('helpers', () => {
        describe('parseGame', () => {
            let parseGame: Dependencies['fullGame']['helpers']['parseGame']
            beforeAll(() => {
                parseGame = fullGame.helpers.parseGame
            })
            it('returns expected data', () => {
                const user = {
                    _id: new Types.ObjectId(),
                    firstName: 'First',
                    lastName: 'Last',
                    username: 'firstlast',
                }
                const data = {
                    teamOne: gameData.teamOne,
                    teamTwo: gameData.teamTwo,
                    teamTwoDefined: gameData.teamTwoDefined,
                    scoreLimit: gameData.scoreLimit,
                    halfScore: gameData.halfScore,
                    startTime: new Date(gameData.startTime),
                    softcapMins: gameData.softcapMins,
                    hardcapMins: gameData.hardcapMins,
                    playersPerPoint: gameData.playersPerPoint,
                    timeoutPerHalf: gameData.timeoutPerHalf,
                    floaterTimeout: gameData.floaterTimeout,
                    tournament: gameData.tournament,
                    teamOneScore: gameData.teamOneScore,
                    teamTwoScore: gameData.teamTwoScore,
                    teamOnePlayers: gameData.teamOnePlayers.map((p) => ({ ...p, localGuest: false })),
                    points: [],
                    creator: gameData.creator,
                }
                const result = parseGame(user, data)
                expect(result).toMatchObject({
                    creator: user,
                    teamOne: gameData.teamOne,
                    teamTwo: gameData.teamTwo,
                    teamTwoDefined: gameData.teamTwoDefined,
                    scoreLimit: gameData.scoreLimit,
                    halfScore: gameData.halfScore,
                    startTime: new Date(gameData.startTime),
                    softcapMins: gameData.softcapMins,
                    hardcapMins: gameData.hardcapMins,
                    playersPerPoint: gameData.playersPerPoint,
                    timeoutPerHalf: gameData.timeoutPerHalf,
                    floaterTimeout: gameData.floaterTimeout,
                    tournament: gameData.tournament,
                    teamOneScore: gameData.teamOneScore,
                    teamTwoScore: gameData.teamTwoScore,
                    teamOnePlayers: gameData.teamOnePlayers,
                    teamOneStatus: GameStatus.COMPLETE,
                    teamTwoStatus: GameStatus.GUEST,
                })
            })
        })

        describe('findOrCreateTournament', () => {
            let findOrCreateTournament: Dependencies['fullGame']['helpers']['findOrCreateTournament']
            beforeAll(() => {
                findOrCreateTournament = fullGame.helpers.findOrCreateTournament
            })

            it('does nothing if tournament is undefined', async () => {
                const data = { ...gameData, tournament: undefined }
                await findOrCreateTournament(data, gameData.creator)
                expect(data.tournament).toBeUndefined()
            })

            it('finds tournament that already exists', async () => {
                const tourney = await Tournament.create({
                    eventId: 'myevent',
                    name: 'My Event',
                    startDate: new Date(),
                    endDate: new Date(),
                    creator: gameData.creator,
                })

                const data = {
                    ...gameData,
                    tournament: {
                        _id: new Types.ObjectId(),
                        eventId: 'myevent',
                        name: 'Wrong Event',
                        startDate: new Date('01/01/2024'),
                        endDate: new Date('01/01/2024'),
                        creator: gameData.creator,
                    },
                }
                await findOrCreateTournament(data, gameData.creator)
                expect(data.tournament.name).toBe(tourney.name)
            })

            it('creates tournament that is not found', async () => {
                const data = {
                    ...gameData,
                    tournament: {
                        _id: new Types.ObjectId(),
                        eventId: 'myevent',
                        name: 'My Event',
                        startDate: new Date('01/01/2024'),
                        endDate: new Date('01/01/2024'),
                        creator: gameData.creator,
                    },
                }
                await findOrCreateTournament(data, gameData.creator)
                expect(data.tournament.name).toBe('My Event')

                const tourneys = await Tournament.find()
                expect(tourneys.length).toBe(1)
                expect(tourneys[0].eventId).toBe('myevent')
            })
        })

        describe('createGuests', () => {
            let createGuests: Dependencies['fullGame']['helpers']['createGuests']
            beforeAll(() => {
                createGuests = fullGame.helpers.createGuests
            })

            it('generates map', async () => {
                const initialGuestId = new Types.ObjectId()
                const generatedGuest = {
                    _id: new Types.ObjectId(),
                    firstName: 'Guest',
                    lastName: 'User',
                    username: 'guest12345',
                }
                const spy = jest.spyOn(UltmtUtils, 'createGuest').mockReturnValueOnce(
                    Promise.resolve({
                        _id: new Types.ObjectId(),
                        place: 'Place',
                        name: 'Name',
                        teamname: 'placename',
                        seasonStart: new Date(),
                        seasonEnd: new Date(),
                        players: [generatedGuest],
                    }),
                )
                const data = [
                    {
                        _id: new Types.ObjectId(),
                        firstName: 'Real',
                        lastName: 'User',
                        username: 'realuser',
                        localGuest: false,
                    },
                    {
                        _id: initialGuestId,
                        firstName: 'Guest',
                        lastName: 'User',
                        username: 'guestuser',
                        localGuest: true,
                    },
                ]

                const result = await createGuests(data, 'jwt', 'team')
                expect(spy).toHaveBeenCalled()
                expect(result.get(initialGuestId.toHexString())).toMatchObject(generatedGuest)
            })
        })
    })
})
