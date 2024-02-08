import { Document, Types } from 'mongoose'
import Game from '../../models/game'
import Point from '../../models/point'
import Action from '../../models/action'
import IGame from '../../types/game'
import { Player } from '../../types/ultmt'
import { idsAreEqual } from '../../utils/mongoose'
import { getClient, getRedisAction, saveRedisAction } from '../../utils/redis'

export const reconcileGuest = async (teamIds: string[], guestId: string, user: Player) => {
    const teamOneGames = await Game.find({ 'teamOne._id': teamIds })
    const teamTwoGames = await Game.find({ 'teamTwo._id': teamIds })

    const teamOnePointMap = await reconcileGames(teamOneGames, guestId, user, 'one')
    const teamTwoPointMap = await reconcileGames(teamTwoGames, guestId, user, 'two')

    const { savedActionIds: teamOneSavedActionIds, livePointMap: teamOneLivePointMap } = await reconcilePoints(
        teamOnePointMap,
        guestId,
        user,
        'one',
    )
    const { savedActionIds: teamTwoSavedActionIds, livePointMap: teamTwoLivePointMap } = await reconcilePoints(
        teamTwoPointMap,
        guestId,
        user,
        'two',
    )

    await reconcileSavedActions(teamOneSavedActionIds, guestId, user)
    await reconcileSavedActions(teamTwoSavedActionIds, guestId, user)

    await reconcileLiveActions(teamOneLivePointMap, guestId, user, 'one')
    await reconcileLiveActions(teamTwoLivePointMap, guestId, user, 'two')
}

export const reconcileGames = async (
    games: (Document<unknown, unknown, IGame> & IGame)[],
    guestId: string,
    user: Player,
    team: 'one' | 'two',
): Promise<{ [x: string]: Types.ObjectId[] }> => {
    const playerList = team === 'one' ? 'teamOnePlayers' : 'teamTwoPlayers'
    const pointMap: { [x: string]: Types.ObjectId[] } = {}
    for (const game of games) {
        replacePlayerInList(game[playerList], guestId, user)

        pointMap[game._id.toHexString()] = game.points
        await game.save()
    }
    return pointMap
}

export const reconcilePoints = async (
    gameMap: { [x: string]: Types.ObjectId[] },
    guestId: string,
    user: Player,
    team: 'one' | 'two',
): Promise<{ savedActionIds: Types.ObjectId[]; livePointMap: { [x: string]: Types.ObjectId[] } }> => {
    const playerList = team === 'one' ? 'teamOnePlayers' : 'teamTwoPlayers'
    const activePlayerList = team === 'one' ? 'teamOneActivePlayers' : 'teamTwoActivePlayers'
    const actionList = team === 'one' ? 'teamOneActions' : 'teamTwoActions'
    const activeBool = team === 'one' ? 'teamOneActive' : 'teamTwoActive'

    const savedActionIds = []

    const livePointMap: { [x: string]: Types.ObjectId[] } = {}
    for (const [gameId, pointIds] of Object.entries(gameMap)) {
        const points = await Point.find({ _id: pointIds })
        livePointMap[gameId] = []
        for (const point of points) {
            replacePlayerInList(point[playerList], guestId, user)
            replacePlayerInList(point[activePlayerList], guestId, user)

            if (!point[activeBool]) {
                savedActionIds.push(...point[actionList])
            } else {
                livePointMap[gameId].push(point._id)
            }
            await point.save()
        }
    }

    return { savedActionIds, livePointMap }
}

export const reconcileSavedActions = async (actionIds: Types.ObjectId[], guestId: string, user: Player) => {
    const actions = await Action.find({ _id: actionIds })
    for (const action of actions) {
        if (idsAreEqual(action.playerOne?._id, guestId)) {
            action.playerOne = user
        } else if (idsAreEqual(action.playerTwo?._id, guestId)) {
            action.playerTwo = user
        }
        await action.save()
    }
}

export const reconcileLiveActions = async (
    gameMap: { [x: string]: Types.ObjectId[] },
    guestId: string,
    user: Player,
    team: 'one' | 'two',
) => {
    const redisClient = await getClient()
    for (const [gameId, pointIds] of Object.entries(gameMap)) {
        for (const pointId of pointIds) {
            const totalActions = await redisClient.get(`${gameId}:${pointId}:${team}:actions`)
            for (let i = 1; i <= Number(totalActions); i++) {
                const action = await getRedisAction(redisClient, pointId.toHexString(), i, team)
                if (idsAreEqual(action.playerOne?._id, guestId)) {
                    action.playerOne = user
                } else if (idsAreEqual(action.playerTwo?._id, guestId)) {
                    action.playerTwo = user
                }
                await saveRedisAction(redisClient, action, pointId.toHexString())
            }
        }
    }
}

const replacePlayerInList = (list: Player[], guestId: string, user: Player) => {
    if (list.findIndex((p) => idsAreEqual(p._id, user._id)) >= 0) return

    const guestIndex = list.findIndex((p) => idsAreEqual(p._id, guestId))
    if (guestIndex < 0) return

    list.splice(guestIndex, 1)
    list.push(user)
}
