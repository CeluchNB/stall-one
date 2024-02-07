import { Document, Types } from 'mongoose'
import Game from '../../models/game'
import Point from '../../models/point'
import Action from '../../models/action'
import IGame from '../../types/game'
import { Player } from '../../types/ultmt'
import { idsAreEqual } from '../../utils/mongoose'

export const reconcileGuest = async (teamIds: string[], guestId: string, user: Player) => {
    const teamOneGames = await Game.find({ 'teamOne._id': teamIds })
    const teamTwoGames = await Game.find({ 'teamTwo._id': teamIds })

    await reconcileGames(teamOneGames, guestId, user, 'one')
    await reconcileGames(teamTwoGames, guestId, user, 'two')
}

const reconcileGames = async (
    games: (Document<unknown, unknown, IGame> & IGame)[],
    guestId: string,
    user: Player,
    team: 'one' | 'two',
) => {
    const playerList = team === 'one' ? 'teamOnePlayers' : 'teamTwoPlayers'
    const pointIds = []
    for (const game of games) {
        replacePlayerInList(game[playerList], guestId, user)
        pointIds.push(...game.points)

        await game.save()
    }
    await reconcilePoints(pointIds, guestId, user, team)
}

const reconcilePoints = async (pointIds: Types.ObjectId[], guestId: string, user: Player, team: 'one' | 'two') => {
    const playerList = team === 'one' ? 'teamOnePlayers' : 'teamTwoPlayers'
    const actionList = team === 'one' ? 'teamOneActions' : 'teamTwoActions'
    const activeBool = team === 'one' ? 'teamOneActive' : 'teamTwoActive'

    const points = await Point.find({ _id: pointIds })
    const savedActionIds = []
    for (const point of points) {
        replacePlayerInList(point[playerList], guestId, user)
        if (point[activeBool]) {
            await reconcileLiveActions('', point._id.toHexString(), team)
        } else {
            savedActionIds.push(...point[actionList])
        }
        await point.save()
    }

    await reconcileSavedActions(savedActionIds, guestId, user)
}

const reconcileSavedActions = async (actionIds: Types.ObjectId[], guestId: string, user: Player) => {
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

const reconcileLiveActions = async (gameId: string, pointId: string, team: 'one' | 'two') => {
    // find live actions
}

const replacePlayerInList = (list: Player[], guestId: string, user: Player) => {
    if (list.findIndex((p) => idsAreEqual(p._id, user._id)) >= 0) return

    list.filter((p) => idsAreEqual(p._id, guestId))
    list.push(user)
}
