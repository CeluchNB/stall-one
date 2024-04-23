import * as Constants from '../../../../../src/utils/constants'
import * as UltmtUtils from '../../../../../src/utils/ultmt'
import { container } from '../../../../../src/di'
import Dependencies from '../../../../../src/types/di'
import { setUpDatabase, tearDownDatabase, resetDatabase, gameData } from '../../../../fixtures/setup-db'
import { client } from '../../../../../src/utils/redis'
import { CreateFullGame, GameStatus } from '../../../../../src/types/game'
import { Types } from 'mongoose'
import Tournament from '../../../../../src/models/tournament'
import { Player } from '../../../../../src/types/ultmt'
import { ActionType, ClientAction } from '../../../../../src/types/action'
import { ClientPoint, PointStatus } from '../../../../../src/types/point'
import Point from '../../../../../src/models/point'
import Action from '../../../../../src/models/action'

jest.mock('@google-cloud/tasks/build/src/v2')

beforeAll(async () => {
    client.connect()
    await setUpDatabase()
})

beforeEach(async () => {
    await resetDatabase()
    jest.resetAllMocks()
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

    const guestId = new Types.ObjectId()
    const guest: Player = {
        _id: guestId,
        firstName: 'Logan',
        lastName: 'Call',
        username: 'logan',
    }
    const anil: Player = {
        _id: new Types.ObjectId(),
        firstName: 'Anil',
        lastName: 'Driehuys',
        username: 'anil',
    }
    const team = {
        _id: new Types.ObjectId(),
        place: 'PGH',
        name: 'Tbirds',
        teamname: 'birds',
        seasonStart: new Date(),
        seasonEnd: new Date(),
    }
    const user1: Player = {
        _id: new Types.ObjectId(),
        firstName: 'Kenny',
        lastName: 'Furdella',
        username: 'kenny',
    }
    const user2: Player = {
        _id: new Types.ObjectId(),
        firstName: 'Tyler',
        lastName: 'McCarthy',
        username: 'tyler',
    }
    const action1: ClientAction = {
        playerOne: user1,
        actionType: ActionType.PULL,
        tags: ['long'],
    }
    const action2: ClientAction = {
        playerOne: user2,
        actionType: ActionType.BLOCK,
        tags: [],
    }
    const action3: ClientAction = {
        playerOne: guest,
        playerTwo: user1,
        actionType: ActionType.TEAM_ONE_SCORE,
        tags: [],
    }
    const pointOne: ClientPoint = {
        pointNumber: 1,
        teamOnePlayers: [],
        teamOneScore: 1,
        teamTwoScore: 0,
        pullingTeam: {
            name: 'Pulling',
        },
        receivingTeam: {
            name: 'Receiving',
        },
        scoringTeam: { name: 'Receiving' },
        actions: [action1, action2, action3],
    }
    const pointTwo: ClientPoint = {
        pointNumber: 2,
        teamOnePlayers: [],
        teamOneScore: 2,
        teamTwoScore: 0,
        pullingTeam: {
            name: 'Pulling',
        },
        receivingTeam: {
            name: 'Receiving',
        },
        scoringTeam: { name: 'Pulling' },
        actions: [action1, action2, action3],
    }
    describe('perform', () => {
        it('creates correct data', async () => {
            const managerSpy = jest.spyOn(UltmtUtils, 'authenticateManager').mockReturnValueOnce(Promise.resolve(user1))
            const guestSpy = jest.spyOn(UltmtUtils, 'createGuest').mockReturnValueOnce(
                Promise.resolve({
                    _id: new Types.ObjectId(),
                    place: 'Place',
                    name: 'Name',
                    teamname: 'placename',
                    seasonStart: new Date(),
                    seasonEnd: new Date(),
                    players: [anil],
                }),
            )
            const gameData: CreateFullGame = {
                teamOne: team,
                teamOnePlayers: [
                    { ...user1, localGuest: false },
                    { ...user2, localGuest: false },
                    { ...guest, localGuest: true },
                ],
                points: [pointOne, pointTwo],
                teamOneScore: 2,
                teamTwoScore: 0,
                teamTwo: { name: 'Wind Chill' },
                teamTwoDefined: false,
                creator: user1,
                scoreLimit: 15,
                halfScore: 7,
                timeoutPerHalf: 1,
                floaterTimeout: false,
                startTime: new Date(),
                softcapMins: 30,
                hardcapMins: 45,
                playersPerPoint: 7,
            }

            const result = await fullGame.perform(gameData, 'jwt')
            expect(result.get(guestId.toHexString())).toMatchObject(anil)

            expect(managerSpy).toHaveBeenCalled()
            expect(guestSpy).toHaveBeenCalled()

            const points = await Point.find({})
            expect(points.length).toBeGreaterThanOrEqual(2)

            const actions = await Action.find({})
            expect(actions.length).toBeGreaterThanOrEqual(6)
        })

        it('throws error with missing team', async () => {
            const gameData: CreateFullGame = {
                teamOne: { name: 'Tbirds' },
                teamOnePlayers: [
                    { ...user1, localGuest: false },
                    { ...user2, localGuest: false },
                    { ...guest, localGuest: true },
                ],
                points: [pointOne, pointTwo],
                teamOneScore: 2,
                teamTwoScore: 0,
                teamTwo: { name: 'Wind Chill' },
                teamTwoDefined: false,
                creator: user1,
                scoreLimit: 15,
                halfScore: 7,
                timeoutPerHalf: 1,
                floaterTimeout: false,
                startTime: new Date(),
                softcapMins: 30,
                hardcapMins: 45,
                playersPerPoint: 7,
            }

            await expect(fullGame.perform(gameData, 'jwt')).rejects.toThrow(Constants.UNABLE_TO_FETCH_TEAM)
        })
    })

    describe('helpers', () => {
        describe('parseGame', () => {
            let parseGame: Dependencies['fullGame']['helpers']['parseGame']
            beforeAll(() => {
                parseGame = fullGame.helpers.parseGame
            })
            it('returns expected data with team two undefined', () => {
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

            it('returns expected data with team two defined', () => {
                const user = {
                    _id: new Types.ObjectId(),
                    firstName: 'First',
                    lastName: 'Last',
                    username: 'firstlast',
                }
                const data = {
                    teamOne: gameData.teamOne,
                    teamTwo: { ...gameData.teamTwo, _id: new Types.ObjectId() },
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
                    teamTwoStatus: GameStatus.DEFINED,
                })
            })
        })

        describe('isTeamTwoDefined', () => {
            let isTeamTwoDefined: Dependencies['fullGame']['helpers']['isTeamTwoDefined']
            beforeAll(() => {
                isTeamTwoDefined = fullGame.helpers.isTeamTwoDefined
            })

            it('with defined team', () => {
                const result = isTeamTwoDefined({
                    teamTwo: { _id: new Types.ObjectId(), name: 'Name' },
                } as CreateFullGame)
                expect(result).toBe(true)
            })

            it('with undefined team', () => {
                const result = isTeamTwoDefined({
                    teamTwo: { name: 'Name' },
                } as CreateFullGame)
                expect(result).toBe(false)
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

        describe('reconcileGuests', () => {
            let reconcileGuests: Dependencies['fullGame']['helpers']['reconcileGuests']
            beforeAll(() => {
                reconcileGuests = fullGame.helpers.reconcileGuests
            })

            it('reconciles guest in all places', () => {
                const guestId = new Types.ObjectId()
                const map = new Map<string, Player>()
                const reid: Player = {
                    _id: new Types.ObjectId(),
                    firstName: 'Reid',
                    lastName: 'Duncan',
                    username: 'reid',
                }
                const guest: Player = {
                    _id: guestId,
                    firstName: 'Max',
                    lastName: 'Sheppard',
                    username: 'max',
                }
                map.set(guestId.toHexString(), reid)

                const game = {
                    teamOnePlayers: [
                        guest,
                        {
                            _id: new Types.ObjectId(),
                            firstName: 'Jon',
                            lastName: 'Mast',
                            username: 'jon',
                        },
                    ],
                    points: [
                        {
                            teamOnePlayers: [
                                guest,
                                {
                                    _id: new Types.ObjectId(),
                                    firstName: 'Anson',
                                    lastName: 'Reppermund',
                                    username: 'anson',
                                },
                            ],
                            actions: [
                                {
                                    playerOne: guest,
                                    actionType: ActionType.PULL,
                                    tags: [],
                                },
                            ],
                        },
                    ],
                } as unknown as CreateFullGame

                reconcileGuests(map, game)

                expect(game.teamOnePlayers[0]).toMatchObject(reid)
                expect(game.points[0].teamOnePlayers[0]).toMatchObject(reid)
                expect(game.points[0].actions[0].playerOne).toMatchObject(reid)
            })
        })

        describe('reconcileGuestsOnGame', () => {
            let reconcileGuestsOnGame: Dependencies['fullGame']['helpers']['reconcileGuestsOnGame']
            beforeAll(() => {
                reconcileGuestsOnGame = fullGame.helpers.reconcileGuestsOnGame
            })

            it('replaces players', () => {
                const guestId = new Types.ObjectId()
                const map = new Map<string, Player>()
                const reid: Player = {
                    _id: new Types.ObjectId(),
                    firstName: 'Reid',
                    lastName: 'Duncan',
                    username: 'reid',
                }
                map.set(guestId.toHexString(), reid)

                const game = {
                    teamOnePlayers: [
                        {
                            _id: guestId,
                            firstName: 'Max',
                            lastName: 'Sheppard',
                            username: 'max',
                        },
                        {
                            _id: new Types.ObjectId(),
                            firstName: 'Jon',
                            lastName: 'Mast',
                            username: 'jon',
                        },
                    ],
                }
                reconcileGuestsOnGame(map, game as CreateFullGame)
                expect(game.teamOnePlayers.length).toBe(2)
                expect(game.teamOnePlayers[0].username).toBe(reid.username)
                expect(game.teamOnePlayers[1].username).toBe('jon')
            })
        })

        describe('reconcileGuestsOnPoints', () => {
            let reconcileGuestsOnPoint: Dependencies['fullGame']['helpers']['reconcileGuestsOnPoints']
            beforeAll(() => {
                reconcileGuestsOnPoint = fullGame.helpers.reconcileGuestsOnPoints
            })

            it('replaces player on multiple points', () => {
                const guestId = new Types.ObjectId()
                const map = new Map<string, Player>()
                const jojah: Player = {
                    _id: new Types.ObjectId(),
                    firstName: 'Jojah',
                    lastName: 'McMonigal',
                    username: 'jojah',
                }
                map.set(guestId.toHexString(), jojah)

                const guest: Player = {
                    _id: guestId,
                    firstName: 'Noah',
                    lastName: 'Celuch',
                    username: 'noah',
                }

                const game: CreateFullGame = {
                    points: [
                        {
                            teamOnePlayers: [
                                guest,
                                {
                                    _id: new Types.ObjectId(),
                                    firstName: 'Anson',
                                    lastName: 'Reppermund',
                                    username: 'anson',
                                },
                            ],
                        },
                        {
                            teamOnePlayers: [
                                {
                                    _id: new Types.ObjectId(),
                                    firstName: 'Thomas',
                                    lastName: 'Hansen',
                                    username: 'thomas',
                                },
                                {
                                    _id: new Types.ObjectId(),
                                    firstName: 'Andrew',
                                    lastName: 'Thompson',
                                    username: 'drew',
                                },
                            ],
                        },
                        {
                            teamOnePlayers: [
                                {
                                    _id: new Types.ObjectId(),
                                    firstName: 'Joe',
                                    lastName: 'Molder',
                                    username: 'joe',
                                },
                                guest,
                            ],
                        },
                    ],
                } as CreateFullGame

                reconcileGuestsOnPoint(map, game)
                expect(game.points.length).toBe(3)
                expect(game.points[0].teamOnePlayers.length).toBe(2)
                expect(game.points[0].teamOnePlayers[0]).toMatchObject(jojah)
                expect(game.points[1].teamOnePlayers.length).toBe(2)
                expect(game.points[1].teamOnePlayers[0]).not.toMatchObject(jojah)
                expect(game.points[1].teamOnePlayers[1]).not.toMatchObject(jojah)
                expect(game.points[2].teamOnePlayers.length).toBe(2)
                expect(game.points[2].teamOnePlayers[1]).toMatchObject(jojah)
            })
        })

        describe('reconcileGuestOnActions', () => {
            let reconcileGuestOnActions: Dependencies['fullGame']['helpers']['reconcileGuestsOnActions']
            beforeAll(() => {
                reconcileGuestOnActions = fullGame.helpers.reconcileGuestsOnActions
            })

            it('reconciles player one on action', () => {
                const guestId = new Types.ObjectId()
                const map = new Map<string, Player>()
                const reid: Player = {
                    _id: new Types.ObjectId(),
                    firstName: 'Reid',
                    lastName: 'Duncan',
                    username: 'reid',
                }
                const guest: Player = {
                    _id: guestId,
                    firstName: 'Robin',
                    lastName: 'Maillard',
                    username: 'robin',
                }
                map.set(guestId.toHexString(), reid)

                const game: CreateFullGame = {
                    points: [
                        {
                            actions: [
                                {
                                    playerOne: guest,
                                    actionType: ActionType.PULL,
                                    tags: [],
                                },
                                { actionType: ActionType.TEAM_TWO_SCORE, tags: [] },
                            ],
                        },
                        {
                            actions: [
                                {
                                    playerOne: {
                                        _id: new Types.ObjectId(),
                                        firstName: 'Zac',
                                        lastName: 'Byrnes',
                                        username: 'zac',
                                    },
                                    playerTwo: {
                                        _id: new Types.ObjectId(),
                                        firstName: 'Charlie',
                                        lastName: 'Vukovic',
                                        username: 'charlie',
                                    },
                                    actionType: ActionType.CATCH,
                                    tags: [],
                                },
                                {
                                    playerOne: guest,
                                    actionType: ActionType.BLOCK,
                                    tags: [],
                                },
                            ],
                        },
                    ],
                } as unknown as CreateFullGame
                reconcileGuestOnActions(map, game)
                expect(game.points[0].actions[0].playerOne).toMatchObject(reid)
                expect(game.points[1].actions[1].playerOne).toMatchObject(reid)
            })

            it('reconciles player two on action', () => {
                const guestId = new Types.ObjectId()
                const map = new Map<string, Player>()
                const reid: Player = {
                    _id: new Types.ObjectId(),
                    firstName: 'Reid',
                    lastName: 'Duncan',
                    username: 'reid',
                }
                const guest: Player = {
                    _id: guestId,
                    firstName: 'Robin',
                    lastName: 'Maillard',
                    username: 'robin',
                }
                map.set(guestId.toHexString(), reid)

                const game: CreateFullGame = {
                    points: [
                        {
                            actions: [
                                {
                                    playerOne: {
                                        _id: new Types.ObjectId(),
                                        firstName: 'Zac',
                                        lastName: 'Byrnes',
                                        username: 'zac',
                                    },
                                    playerTwo: guest,
                                    actionType: ActionType.PULL,
                                    tags: [],
                                },
                                { actionType: ActionType.TEAM_TWO_SCORE, tags: [] },
                            ],
                        },
                        {
                            actions: [
                                {
                                    playerOne: {
                                        _id: new Types.ObjectId(),
                                        firstName: 'Zac',
                                        lastName: 'Byrnes',
                                        username: 'zac',
                                    },
                                    playerTwo: {
                                        _id: new Types.ObjectId(),
                                        firstName: 'Charlie',
                                        lastName: 'Vukovic',
                                        username: 'charlie',
                                    },
                                    actionType: ActionType.CATCH,
                                    tags: [],
                                },
                                {
                                    playerTwo: guest,
                                    actionType: ActionType.BLOCK,
                                    tags: [],
                                },
                            ],
                        },
                    ],
                } as unknown as CreateFullGame
                reconcileGuestOnActions(map, game)
                expect(game.points[0].actions[0].playerTwo).toMatchObject(reid)
                expect(game.points[0].actions[0].playerOne).not.toMatchObject(reid)
                expect(game.points[1].actions[1].playerTwo).toMatchObject(reid)
            })
        })

        describe('uploadPoints', () => {
            let uploadPoints: Dependencies['fullGame']['helpers']['uploadPoints']
            beforeAll(() => {
                uploadPoints = fullGame.helpers.uploadPoints
            })

            const team = {
                _id: new Types.ObjectId(),
                place: 'PGH',
                name: 'Tbirds',
                teamname: 'birds',
                seasonStart: new Date(),
                seasonEnd: new Date(),
            }
            const user1: Player = {
                _id: new Types.ObjectId(),
                firstName: 'Kenny',
                lastName: 'Furdella',
                username: 'kenny',
            }
            const user2: Player = {
                _id: new Types.ObjectId(),
                firstName: 'Tyler',
                lastName: 'McCarthy',
                username: 'tyler',
            }
            const action1: ClientAction = {
                playerOne: user1,
                actionType: ActionType.PULL,
                tags: ['long'],
            }
            const action2: ClientAction = {
                playerOne: user2,
                actionType: ActionType.BLOCK,
                tags: [],
            }
            const action3: ClientAction = {
                playerOne: user2,
                playerTwo: user1,
                actionType: ActionType.TEAM_ONE_SCORE,
                tags: [],
            }
            const pointOne: ClientPoint = {
                pointNumber: 1,
                teamOnePlayers: [],
                teamOneScore: 1,
                teamTwoScore: 0,
                pullingTeam: {
                    name: 'Pulling',
                },
                receivingTeam: {
                    name: 'Receiving',
                },
                scoringTeam: { name: 'Receiving' },
                actions: [action1, action2, action3],
            }
            const pointTwo: ClientPoint = {
                pointNumber: 2,
                teamOnePlayers: [],
                teamOneScore: 2,
                teamTwoScore: 0,
                pullingTeam: {
                    name: 'Pulling',
                },
                receivingTeam: {
                    name: 'Receiving',
                },
                scoringTeam: { name: 'Pulling' },
                actions: [action1, action2, action3],
            }

            it('creates points and actions', async () => {
                const gameId = new Types.ObjectId()
                await uploadPoints({ points: [pointOne, pointTwo], teamOne: team } as CreateFullGame, gameId)
                const points = await Point.find({ gameId })
                expect(points.length).toBe(2)

                const pointOneActions = await Action.find({ pointId: points[0]._id })
                expect(pointOneActions.length).toBe(3)

                const pointTwoActions = await Action.find({ pointId: points[1]._id })
                expect(pointTwoActions.length).toBe(3)
            })
        })

        describe('createPoint', () => {
            let createPoint: Dependencies['fullGame']['helpers']['createPoint']
            beforeAll(() => {
                createPoint = fullGame.helpers.createPoint
            })

            it('creates point', async () => {
                const point: ClientPoint = {
                    pointNumber: 1,
                    teamOnePlayers: [],
                    teamOneScore: 1,
                    teamTwoScore: 0,
                    pullingTeam: {
                        name: 'Pulling',
                    },
                    receivingTeam: {
                        name: 'Receiving',
                    },
                    scoringTeam: { name: 'Receiving' },
                    actions: [],
                }
                const gameId = new Types.ObjectId()

                const result = await createPoint(point, gameId)
                expect(result.pointNumber).toBe(1)
                expect(result.teamOneScore).toBe(1)
                expect(result.teamTwoScore).toBe(0)
                expect(result.pullingTeam).toMatchObject({ name: 'Pulling' })
                expect(result.receivingTeam).toMatchObject({ name: 'Receiving' })
                expect(result.scoringTeam).toMatchObject({ name: 'Receiving' })
                expect(result.teamOneStatus).toBe(PointStatus.COMPLETE)
                expect(result.teamTwoStatus).toBe(PointStatus.FUTURE)
                expect(result.gameId.toHexString()).toBe(gameId.toHexString())

                const pointRecord = await Point.findById(result._id)
                expect(pointRecord).toMatchObject({ gameId, pointNumber: 1 })
            })
        })

        describe('createActions', () => {
            let createActions: Dependencies['fullGame']['helpers']['createActions']
            beforeAll(() => {
                createActions = fullGame.helpers.createActions
            })

            it('creates multiple actions', async () => {
                const pointId = new Types.ObjectId()
                const team = {
                    _id: new Types.ObjectId(),
                    place: 'PGH',
                    name: 'Tbirds',
                    teamname: 'birds',
                    seasonStart: new Date(),
                    seasonEnd: new Date(),
                }
                const user1: Player = {
                    _id: new Types.ObjectId(),
                    firstName: 'Kenny',
                    lastName: 'Furdella',
                    username: 'kenny',
                }
                const user2: Player = {
                    _id: new Types.ObjectId(),
                    firstName: 'Tyler',
                    lastName: 'McCarthy',
                    username: 'tyler',
                }
                const action1: ClientAction = {
                    playerOne: user1,
                    actionType: ActionType.PULL,
                    tags: ['long'],
                }
                const action2: ClientAction = {
                    playerOne: user2,
                    actionType: ActionType.BLOCK,
                    tags: [],
                }
                const action3: ClientAction = {
                    playerOne: user2,
                    playerTwo: user1,
                    actionType: ActionType.TEAM_ONE_SCORE,
                    tags: [],
                }
                const point: ClientPoint = {
                    pointNumber: 1,
                    teamOnePlayers: [],
                    teamOneScore: 1,
                    teamTwoScore: 0,
                    pullingTeam: {
                        name: 'Pulling',
                    },
                    receivingTeam: {
                        name: 'Receiving',
                    },
                    scoringTeam: { name: 'Receiving' },
                    actions: [action1, action2, action3],
                }

                const result = await createActions(point, team, pointId)
                expect(result.length).toBe(3)
                expect(result[0].actionNumber).toBe(1)
                expect(result[0].actionType).toBe(ActionType.PULL)
                expect(result[1].actionNumber).toBe(2)
                expect(result[1].actionType).toBe(ActionType.BLOCK)
                expect(result[2].actionNumber).toBe(3)
                expect(result[2].actionType).toBe(ActionType.TEAM_ONE_SCORE)

                const actionRecords = await Action.find()
                expect(actionRecords.length).toBeGreaterThanOrEqual(3)
            })
        })
    })
})
