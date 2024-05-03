import { Types } from 'mongoose'
import Game from '../../../../src/models/game'
import { close } from '../../../../src/app'
import { setUpDatabase, resetDatabase, tearDownDatabase, createData, client } from '../../../fixtures/setup-db'
import {
    reconcileGames,
    reconcileGuest,
    reconcileLiveActions,
    reconcilePoints,
    reconcileSavedActions,
    replacePlayerInList,
} from '../../../../src/services/v1/reconcile-guest'
import Point from '../../../../src/models/point'
import Action from '../../../../src/models/action'
import { getRedisAction, saveRedisAction, saveRedisComment } from '../../../../src/utils/redis'
import { ActionType } from '../../../../src/types/action'
import { PointStatus } from '../../../../src/types/point'

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

describe('Reconcile guest pieces', () => {
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

            const gameResult = await Game.findById(game._id)
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
        const gameId = new Types.ObjectId()
        it('team one with saved actions', async () => {
            const point = await Point.create({
                gameId,
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
                gameId,
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
                gameId,
                pointNumber: 1,
                pullingTeam: { name: 'Team 1' },
                receivingTeam: { name: 'Team 2' },
                teamOneScore: 0,
                teamTwoScore: 1,
                teamOneActive: true,
                teamOneStatus: PointStatus.ACTIVE,
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
        const pointId = new Types.ObjectId()
        it('replaces player one actions', async () => {
            const action1 = await Action.create({
                pointId,
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
                pointId,
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
                pointId,
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
                pointId,
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
            await saveRedisComment(
                client,
                point1Id.toHexString(),
                2,
                {
                    user: realUser,
                    comment: 'test comment',
                },
                'one',
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
            expect(action2Result.comments.length).toBe(1)
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

    describe('replacePlayerInList', () => {
        it('replaces found player', () => {
            const list = [user1, guest, user2]
            replacePlayerInList(list, guestId.toHexString(), realUser)
            expect(list).toEqual(expect.arrayContaining([expect.objectContaining(realUser)]))
        })

        it('skips if player already in list', () => {
            const list = [user1, realUser, user2]

            replacePlayerInList(list, guestId.toHexString(), realUser)

            expect(list.length).toBe(3)
            expect(list).toEqual(expect.arrayContaining([expect.objectContaining(realUser)]))
        })

        it('skips if guest player not found', () => {
            const list = [user1, user2]
            replacePlayerInList(list, guestId.toHexString(), realUser)
            expect(list).not.toEqual(expect.arrayContaining([expect.objectContaining(realUser)]))
        })
    })
})

describe('reconcileGuest', () => {
    const team = {
        _id: new Types.ObjectId(),
        place: 'Team',
        name: 'Team',
        teamname: 'team',
        seasonStart: new Date(),
        seasonEnd: new Date(),
    }
    const gameOneId = new Types.ObjectId()
    const gameTwoId = new Types.ObjectId()
    const pointOneId = new Types.ObjectId()
    const pointThreeId = new Types.ObjectId()
    beforeEach(async () => {
        const action1 = await Action.create({
            actionNumber: 1,
            actionType: 'Pull',
            team: team,
            playerOne: user1,
            playerTwo: user2,
            pointId: pointOneId,
        })
        const action2 = await Action.create({
            actionNumber: 2,
            actionType: 'Catch',
            team: team,
            playerOne: guest,
            playerTwo: user2,
            pointId: pointOneId,
        })
        const action3 = await Action.create({
            actionNumber: 3,
            actionType: 'Catch',
            team: team,
            playerOne: user1,
            playerTwo: guest,
            pointId: pointOneId,
        })

        const action4 = await Action.create({
            actionNumber: 1,
            actionType: 'Pull',
            team: team,
            playerOne: user1,
            playerTwo: user2,
            pointId: pointThreeId,
        })
        const action5 = await Action.create({
            actionNumber: 2,
            actionType: 'Catch',
            team: team,
            playerOne: guest,
            playerTwo: user2,
            pointId: pointThreeId,
        })
        const action6 = await Action.create({
            actionNumber: 3,
            actionType: 'Catch',
            team: team,
            playerOne: user1,
            playerTwo: guest,
            pointId: pointThreeId,
        })

        const point1 = await Point.create({
            _id: pointOneId,
            gameId: gameOneId,
            pointNumber: 1,
            pullingTeam: { name: 'Team 1' },
            receivingTeam: { name: 'Team 2' },
            teamOneScore: 0,
            teamTwoScore: 1,
            teamOneActive: false,
            teamOneStatus: PointStatus.COMPLETE,
            teamTwoStatus: PointStatus.COMPLETE,
            teamOneActions: [action1._id, action2._id, action3._id],
            teamOnePlayers: [guest, user1, user2],
            teamOneActivePlayers: [user1, guest, user2],
        })
        const point2 = await Point.create({
            gameId: gameOneId,
            pointNumber: 2,
            pullingTeam: { name: 'Team 1' },
            receivingTeam: { name: 'Team 2' },
            teamOneScore: 0,
            teamTwoScore: 1,
            teamOneActive: true,
            teamOneStatus: PointStatus.ACTIVE,
            teamTwoStatus: PointStatus.COMPLETE,
            teamOneActions: [],
            teamOnePlayers: [user1, guest, user2],
            teamOneActivePlayers: [guest, user1, user2],
        })
        const point3 = await Point.create({
            _id: pointThreeId,
            gameId: gameTwoId,
            pointNumber: 1,
            pullingTeam: { name: 'Team 1' },
            receivingTeam: { name: 'Team 2' },
            teamOneScore: 0,
            teamTwoScore: 1,
            teamTwoActive: false,
            teamOneStatus: PointStatus.FUTURE,
            teamTwoStatus: PointStatus.COMPLETE,
            teamTwoActions: [action4._id, action5._id, action6._id],
            teamTwoPlayers: [user1, guest, user2],
            teamTwoActivePlayers: [guest, user1, user2],
        })
        const point4 = await Point.create({
            gameId: gameTwoId,
            pointNumber: 2,
            pullingTeam: { name: 'Team 1' },
            receivingTeam: { name: 'Team 2' },
            teamOneScore: 0,
            teamTwoScore: 1,
            teamTwoActive: true,
            teamOneStatus: PointStatus.FUTURE,
            teamTwoStatus: PointStatus.ACTIVE,
            teamTwoActions: [],
            teamTwoPlayers: [user1, guest, user2],
            teamTwoActivePlayers: [guest, user1, user2],
        })

        const game1 = await Game.create({
            ...createData,
            _id: gameOneId,
            teamOne: team,
            teamOnePlayers: [user1, guest, user2],
            points: [point1._id, point2._id],
        })
        const game2 = await Game.create({
            ...createData,
            _id: gameTwoId,
            teamTwo: team,
            teamTwoPlayers: [user1, guest, user2],
            points: [point3._id, point4._id],
        })

        await client.set(`${game1._id}:${point2._id}:one:actions`, 2)
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
            point2._id.toHexString(),
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
            point2._id.toHexString(),
        )

        await client.set(`${game2._id}:${point4._id}:two:actions`, 2)
        await saveRedisAction(
            client,
            {
                actionNumber: 1,
                teamNumber: 'two',
                comments: [],
                actionType: ActionType.PULL,
                tags: [],
                playerOne: guest,
            },
            point4._id.toHexString(),
        )
        await saveRedisAction(
            client,
            {
                actionNumber: 2,
                teamNumber: 'two',
                comments: [],
                actionType: ActionType.CATCH,
                tags: [],
                playerOne: guest,
                playerTwo: user1,
            },
            point4._id.toHexString(),
        )

        await reconcileGuest([team._id.toHexString()], guest._id.toHexString(), realUser)
    })

    it('successfully updates games', async () => {
        const [game1, game2] = await Game.find()
        expect(game1.teamOnePlayers.length).toBe(3)
        expect(game1.teamOnePlayers).toEqual(expect.arrayContaining([expect.objectContaining(realUser)]))
        expect(game2.teamTwoPlayers.length).toBe(3)
        expect(game2.teamTwoPlayers).toEqual(expect.arrayContaining([expect.objectContaining(realUser)]))
    })

    it('successfully updates points', async () => {
        const [point1, point2, point3, point4] = await Point.find()
        expect(point1.teamOnePlayers.length).toBe(3)
        expect(point1.teamOnePlayers).toEqual(expect.arrayContaining([expect.objectContaining(realUser)]))
        expect(point1.teamOneActivePlayers).toEqual(expect.arrayContaining([expect.objectContaining(realUser)]))

        expect(point2.teamOnePlayers.length).toBe(3)
        expect(point2.teamOnePlayers).toEqual(expect.arrayContaining([expect.objectContaining(realUser)]))
        expect(point2.teamOneActivePlayers).toEqual(expect.arrayContaining([expect.objectContaining(realUser)]))

        expect(point3.teamTwoPlayers.length).toBe(3)
        expect(point3.teamTwoPlayers).toEqual(expect.arrayContaining([expect.objectContaining(realUser)]))
        expect(point3.teamTwoActivePlayers).toEqual(expect.arrayContaining([expect.objectContaining(realUser)]))

        expect(point4.teamTwoPlayers.length).toBe(3)
        expect(point4.teamTwoPlayers).toEqual(expect.arrayContaining([expect.objectContaining(realUser)]))
        expect(point4.teamTwoActivePlayers).toEqual(expect.arrayContaining([expect.objectContaining(realUser)]))
    })

    it('successfully updates saved actions', async () => {
        const actions = await Action.find()
        expect(actions[0]).toMatchObject({ playerOne: user1, playerTwo: user2 })
        expect(actions[1]).toMatchObject({ playerOne: realUser, playerTwo: user2 })
        expect(actions[2]).toMatchObject({ playerOne: user1, playerTwo: realUser })
        expect(actions[3]).toMatchObject({ playerOne: user1, playerTwo: user2 })
        expect(actions[4]).toMatchObject({ playerOne: realUser, playerTwo: user2 })
        expect(actions[5]).toMatchObject({ playerOne: user1, playerTwo: realUser })
    })

    it('successfully updates live actions', async () => {
        const [, point2, , point4] = await Point.find()
        const action1Result = await getRedisAction(client, point2._id.toHexString(), 1, 'one')
        expect(action1Result).toMatchObject({
            actionNumber: 1,
            actionType: 'Pull',
            teamNumber: 'one',
            playerOne: realUser,
        })

        const action2Result = await getRedisAction(client, point2._id.toHexString(), 2, 'one')
        expect(action2Result).toMatchObject({
            actionNumber: 2,
            actionType: 'Catch',
            teamNumber: 'one',
            playerOne: realUser,
            playerTwo: user1,
        })

        const action3Result = await getRedisAction(client, point4._id.toHexString(), 1, 'two')
        expect(action3Result).toMatchObject({
            actionNumber: 1,
            actionType: 'Pull',
            teamNumber: 'two',
            playerOne: realUser,
        })

        const action4Result = await getRedisAction(client, point4._id.toHexString(), 2, 'two')
        expect(action4Result).toMatchObject({
            actionNumber: 2,
            actionType: 'Catch',
            teamNumber: 'two',
            playerOne: realUser,
            playerTwo: user1,
        })
    })
})
