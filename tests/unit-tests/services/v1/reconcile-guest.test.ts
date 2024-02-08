import { Types } from 'mongoose'
import Game from '../../../../src/models/game'
import { close } from '../../../../src/app'
import { setUpDatabase, resetDatabase, tearDownDatabase, createData, client } from '../../../fixtures/setup-db'
import {
    reconcileGames,
    reconcileLiveActions,
    reconcilePoints,
    reconcileSavedActions,
} from '../../../../src/services/v1/reconcile-guest'
import Point from '../../../../src/models/point'
import Action from '../../../../src/models/action'
import { getRedisAction, saveRedisAction } from '../../../../src/utils/redis'
import { ActionType } from '../../../../src/types/action'

beforeAll(async () => {
    await setUpDatabase()
})

afterEach(async () => {
    await resetDatabase()
})

afterAll(async () => {
    await close()
    await tearDownDatabase()
})

describe('Reconcile guest', () => {
    const guestId = new Types.ObjectId()
    const user1 = {
        _id: new Types.ObjectId(),
        firstName: 'Noah',
        lastName: 'Celuch',
        username: 'noah',
    }
    const guest = {
        _id: guestId,
        firstName: 'Guestfirst',
        lastName: 'Guestlast',
        username: 'guest',
    }
    const user2 = {
        _id: new Types.ObjectId(),
        firstName: 'Noah',
        lastName: 'Celuch',
        username: 'noah',
    }
    const realUser = {
        _id: new Types.ObjectId(),
        firstName: 'Realfirst',
        lastName: 'Reallast',
        username: 'real',
    }

    describe('reconcileGames', () => {
        it('handles team one replace', async () => {
            const game = await Game.create({
                ...createData,
                teamOnePlayers: [user1, guest, user2],
                points: [new Types.ObjectId(), new Types.ObjectId()],
            })
            const result = await reconcileGames([game], guestId.toHexString(), realUser, 'one')
            expect(result).toMatchObject({
                [game._id.toHexString()]: [...game.points],
            })

            const gameResult = await Game.findOne()
            expect(gameResult?.teamOnePlayers.length).toBe(3)
            expect(gameResult?.teamOnePlayers[2]).toMatchObject(realUser)
        })

        it('handles team two replace', async () => {
            const game = await Game.create({
                ...createData,
                teamTwoPlayers: [user1, guest, user2],
                points: [new Types.ObjectId(), new Types.ObjectId()],
            })
            const result = await reconcileGames([game], guestId.toHexString(), realUser, 'two')
            expect(result).toMatchObject({
                [game._id.toHexString()]: [...game.points],
            })

            const gameResult = await Game.findOne()
            expect(gameResult?.teamTwoPlayers.length).toBe(3)
            expect(gameResult?.teamTwoPlayers[2]).toMatchObject(realUser)
        })
    })

    describe('reconcilePoints', () => {
        it('team one with saved actions', async () => {
            const point = await Point.create({
                pointNumber: 1,
                pullingTeam: { name: 'Team 1' },
                receivingTeam: { name: 'Team 2' },
                teamOneScore: 0,
                teamTwoScore: 1,
                teamOneActive: false,
                teamOneActions: [new Types.ObjectId(), new Types.ObjectId()],
                teamOnePlayers: [user1, guest, user2],
                teamOneActivePlayers: [user1, guest, user2],
            })

            const result = await reconcilePoints({ game: [point._id] }, guest._id.toHexString(), realUser, 'one')
            expect(result).toMatchObject({ savedActionIds: point.teamOneActions, livePointMap: {} })

            const pointResult = await Point.findOne()
            expect(pointResult?.teamOnePlayers.length).toBe(3)
            expect(pointResult?.teamOnePlayers[2]).toMatchObject(realUser)
            expect(pointResult?.teamOneActivePlayers.length).toBe(3)
            expect(pointResult?.teamOneActivePlayers[2]).toMatchObject(realUser)
        })

        it('team two with saved actions', async () => {
            const point = await Point.create({
                pointNumber: 1,
                pullingTeam: { name: 'Team 1' },
                receivingTeam: { name: 'Team 2' },
                teamOneScore: 0,
                teamTwoScore: 1,
                teamTwoActive: false,
                teamTwoActions: [new Types.ObjectId(), new Types.ObjectId()],
                teamTwoPlayers: [user1, guest, user2],
                teamTwoActivePlayers: [user1, guest, user2],
            })

            const result = await reconcilePoints({ game: [point._id] }, guest._id.toHexString(), realUser, 'two')
            expect(result).toMatchObject({ savedActionIds: point.teamTwoActions, livePointMap: {} })

            const pointResult = await Point.findOne()
            expect(pointResult?.teamTwoPlayers.length).toBe(3)
            expect(pointResult?.teamTwoPlayers[2]).toMatchObject(realUser)
            expect(pointResult?.teamTwoActivePlayers.length).toBe(3)
            expect(pointResult?.teamTwoActivePlayers[2]).toMatchObject(realUser)
        })

        it('team one with live point', async () => {
            const point = await Point.create({
                pointNumber: 1,
                pullingTeam: { name: 'Team 1' },
                receivingTeam: { name: 'Team 2' },
                teamOneScore: 0,
                teamTwoScore: 1,
                teamOneActive: true,
                teamOneActions: [new Types.ObjectId(), new Types.ObjectId()],
                teamOnePlayers: [user1, guest, user2],
                teamOneActivePlayers: [user1, guest, user2],
            })

            const result = await reconcilePoints({ game: [point._id] }, guest._id.toHexString(), realUser, 'one')
            expect(result).toMatchObject({
                savedActionIds: [],
                livePointMap: { game: [point._id] },
            })

            const pointResult = await Point.findOne()
            expect(pointResult?.teamOnePlayers.length).toBe(3)
            expect(pointResult?.teamOnePlayers[2]).toMatchObject(realUser)
            expect(pointResult?.teamOneActivePlayers.length).toBe(3)
            expect(pointResult?.teamOneActivePlayers[2]).toMatchObject(realUser)
        })
    })

    describe('reconcileSavedActions', () => {
        it('replaces player one actions', async () => {
            const action1 = await Action.create({
                actionNumber: 1,
                actionType: 'Pull',
                team: {
                    _id: new Types.ObjectId(),
                    place: 'Place1',
                    name: 'Name1',
                    teamname: 'placename',
                },
                playerOne: guest,
            })
            const action2 = await Action.create({
                actionNumber: 2,
                actionType: 'Catch',
                team: {
                    _id: new Types.ObjectId(),
                    place: 'Place1',
                    name: 'Name1',
                    teamname: 'placename',
                },
                playerOne: guest,
                playerTwo: user2,
            })

            await reconcileSavedActions([action1._id, action2._id], guestId.toHexString(), realUser)

            const action1Result = await Action.findById(action1._id)
            expect(action1Result?.playerOne).toMatchObject(realUser)

            const action2Result = await Action.findById(action2._id)
            expect(action2Result?.playerOne).toMatchObject(realUser)
        })

        it('replaces player two actions', async () => {
            const action1 = await Action.create({
                actionNumber: 1,
                actionType: 'Pull',
                team: {
                    _id: new Types.ObjectId(),
                    place: 'Place1',
                    name: 'Name1',
                    teamname: 'placename',
                },
                playerOne: user2,
                playerTwo: guest,
            })
            const action2 = await Action.create({
                actionNumber: 2,
                actionType: 'Catch',
                team: {
                    _id: new Types.ObjectId(),
                    place: 'Place1',
                    name: 'Name1',
                    teamname: 'placename',
                },
                playerOne: user1,
                playerTwo: guest,
            })

            await reconcileSavedActions([action1._id, action2._id], guestId.toHexString(), realUser)

            const action1Result = await Action.findById(action1._id)
            expect(action1Result?.playerTwo).toMatchObject(realUser)

            const action2Result = await Action.findById(action2._id)
            expect(action2Result?.playerTwo).toMatchObject(realUser)
        })
    })

    describe('reconcileLiveActions', () => {
        const gameId = new Types.ObjectId()
        const point1Id = new Types.ObjectId()
        const point2Id = new Types.ObjectId()

        it('saves action with player one guest on team one', async () => {
            await client.set(`${gameId}:${point1Id}:one:actions`, 2)
            await saveRedisAction(
                client,
                {
                    actionNumber: 1,
                    teamNumber: 'one',
                    comments: [],
                    actionType: ActionType.PULL,
                    tags: [],
                    playerOne: guest,
                },
                point1Id.toHexString(),
            )
            await saveRedisAction(
                client,
                {
                    actionNumber: 2,
                    teamNumber: 'one',
                    comments: [],
                    actionType: ActionType.CATCH,
                    tags: [],
                    playerOne: guest,
                    playerTwo: user1,
                },
                point1Id.toHexString(),
            )

            await reconcileLiveActions(
                { [gameId.toHexString()]: [point1Id, point2Id] },
                guestId.toHexString(),
                realUser,
                'one',
            )

            const action1Result = await getRedisAction(client, point1Id.toHexString(), 1, 'one')
            expect(action1Result).toMatchObject({
                actionNumber: 1,
                actionType: 'Pull',
                teamNumber: 'one',
                playerOne: realUser,
            })

            const action2Result = await getRedisAction(client, point1Id.toHexString(), 2, 'one')
            expect(action2Result).toMatchObject({
                actionNumber: 2,
                actionType: 'Catch',
                teamNumber: 'one',
                playerOne: realUser,
                playerTwo: user1,
            })
        })

        it('saved action with player two guest on team two', async () => {
            await client.set(`${gameId}:${point1Id}:two:actions`, 1)
            await client.set(`${gameId}:${point2Id}:two:actions`, 1)

            await saveRedisAction(
                client,
                {
                    actionNumber: 1,
                    teamNumber: 'two',
                    comments: [],
                    actionType: ActionType.PULL,
                    tags: [],
                    playerOne: user2,
                    playerTwo: guest,
                },
                point1Id.toHexString(),
            )
            await saveRedisAction(
                client,
                {
                    actionNumber: 1,
                    teamNumber: 'two',
                    comments: [],
                    actionType: ActionType.CATCH,
                    tags: [],
                    playerOne: user1,
                    playerTwo: guest,
                },
                point2Id.toHexString(),
            )

            await reconcileLiveActions(
                { [gameId.toHexString()]: [point1Id, point2Id] },
                guestId.toHexString(),
                realUser,
                'two',
            )

            const action1Result = await getRedisAction(client, point1Id.toHexString(), 1, 'two')
            expect(action1Result).toMatchObject({
                actionNumber: 1,
                actionType: 'Pull',
                teamNumber: 'two',
                playerTwo: realUser,
            })

            const action2Result = await getRedisAction(client, point2Id.toHexString(), 1, 'two')
            expect(action2Result).toMatchObject({
                actionNumber: 1,
                actionType: 'Catch',
                teamNumber: 'two',
                playerTwo: realUser,
                playerOne: user1,
            })
        })
    })
})
