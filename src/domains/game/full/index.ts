import * as Constants from '../../../utils/constants'
import IAction from '../../../types/action'
import Dependencies from '../../../types/di'
import { ApiError } from '../../../types/errors'
import IGame, { CreateFullGame, CreateGame, GameStatus } from '../../../types/game'
import IPoint, { ClientPoint, PointStatus } from '../../../types/point'
import { FullGameUser, Player, Team, UserResponse } from '../../../types/ultmt'
import { sendCloudTask } from '../../../utils/cloud-tasks'
import { authenticateManager, createGuest, parseUser } from '../../../utils/ultmt'
import { Types } from 'mongoose'

export const fullGame = ({ gameModel, pointModel, actionModel, tournamentModel, ultmtUrl, apiKey }: Dependencies) => {
    const perform = async (gameData: CreateFullGame, userJwt: string) => {
        const teamId = gameData.teamOne._id?.toString()
        if (!teamId) {
            throw new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 404)
        }

        const user = await authenticateManager(ultmtUrl, apiKey, userJwt, teamId)
        const safeData = parseGame(user, gameData)

        await findOrCreateTournament(safeData, user)

        // create game
        const game = await gameModel.create(safeData)
        await createStatsGame(game)

        // Find or create guests
        const guestMap = await createGuests(safeData.teamOnePlayers, userJwt, teamId)
        reconcileGuests(guestMap, gameData)

        await uploadPoints(gameData, game._id)

        await game.save()
        await sendCloudTask(`/api/v1/stats/game/finish/${game._id}`, {}, 'PUT')
        return guestMap
    }

    const parseGame = (user: UserResponse, gameData: CreateFullGame) => {
        return {
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
            teamTwoStatus: GameStatus.GUEST, // TODO: DETERMINE IF GUEST OR DEFINED
        }
    }

    const findOrCreateTournament = async (data: CreateGame, user: UserResponse) => {
        if (data.tournament) {
            const tournament = await tournamentModel.findOne({ eventId: data.tournament.eventId })
            if (tournament) {
                data.tournament = tournament
            } else {
                const { name, eventId, startDate, endDate } = data.tournament
                const newTournament = await tournamentModel.create({
                    name,
                    eventId,
                    startDate,
                    endDate,
                    creator: parseUser(user),
                })
                data.tournament = newTournament
            }
        }
    }

    const createGuests = async (
        teamOnePlayers: FullGameUser[],
        userJwt: string,
        teamId: string,
    ): Promise<Map<string, Player>> => {
        const guestMap = new Map<string, Player>()
        for (const player of teamOnePlayers) {
            if (player.localGuest) {
                const updatedTeam = await createGuest(ultmtUrl, apiKey, userJwt, teamId, player)
                guestMap.set(player._id.toString(), updatedTeam.players[updatedTeam.players.length - 1])
            }
        }

        return guestMap
    }

    const reconcileGuests = (map: Map<string, Player>, game: CreateFullGame) => {
        reconcileGuestsOnGame(map, game)
        reconcileGuestsOnPoints(map, game)
        reconcileGuestsOnActions(map, game)
    }

    const reconcileGuestsOnGame = (map: Map<string, Player>, game: CreateFullGame) => {
        for (let i = 0; i < game.teamOnePlayers.length; i++) {
            const id = game.teamOnePlayers[i]._id.toString()
            const mapPlayer = map.get(id)
            if (mapPlayer) {
                game.teamOnePlayers[i] = { ...mapPlayer, localGuest: false }
            }
        }
    }

    const reconcileGuestsOnPoints = (map: Map<string, Player>, game: CreateFullGame) => {
        for (let i = 0; i < game.points.length; i++) {
            for (let j = 0; j < game.points[i].teamOnePlayers.length; j++) {
                const id = game.points[i].teamOnePlayers[j]._id.toString()
                const mapPlayer = map.get(id)
                if (mapPlayer) {
                    game.points[i].teamOnePlayers[j] = mapPlayer
                }
            }
        }
    }

    const reconcileGuestsOnActions = (map: Map<string, Player>, game: CreateFullGame) => {
        for (let i = 0; i < game.points.length; i++) {
            for (let j = 0; j < game.points[i].actions.length; j++) {
                const playerOneId = game.points[i].actions[j].playerOne?._id.toString() ?? ''
                const mapPlayerOne = map.get(playerOneId)
                if (mapPlayerOne) {
                    game.points[i].actions[j].playerOne = mapPlayerOne
                }

                const playerTwoId = game.points[i].actions[j].playerTwo?._id.toString() ?? ''
                const mapPlayerTwo = map.get(playerTwoId)
                if (mapPlayerTwo) {
                    game.points[i].actions[j].playerTwo = mapPlayerTwo
                }
            }
        }
    }

    const uploadPoints = async (gameData: CreateFullGame, gameId: Types.ObjectId) => {
        const points = gameData.points
        for (const p of points) {
            const point = await createPoint(p, gameId)
            const actions = await createActions(p, gameData.teamOne, point._id)
            await createStatsPoint(point, gameId.toHexString(), actions)
        }
    }

    const createPoint = async (point: ClientPoint, gameId: Types.ObjectId) => {
        return await pointModel.create({
            ...point,
            teamOneActive: false,
            teamTwoActive: false,
            teamOneStatus: PointStatus.COMPLETE,
            teamTwoStatus: PointStatus.FUTURE,
            gameId: gameId,
        })
    }

    const createActions = async (point: ClientPoint, team: Team, pointId: Types.ObjectId): Promise<IAction[]> => {
        const actions = []
        for (const [i, a] of point.actions.entries()) {
            const action = await actionModel.create({
                ...a,
                pointId,
                team,
                actionNumber: i + 1,
            })
            actions.push(action)
        }
        return actions
    }

    const createStatsGame = async (game: IGame) => {
        await sendCloudTask(
            '/api/v1/stats/game',
            {
                game: {
                    _id: game._id,
                    startTime: game.startTime,
                    teamOne: game.teamOne,
                    teamTwo: game.teamTwo,
                    teamOnePlayers: game.teamOnePlayers,
                    teamTwoPlayers: game.teamTwoPlayers,
                },
            },
            'POST',
        )
    }

    const createStatsPoint = async (point: IPoint, gameId: string, actions: IAction[]) => {
        await sendCloudTask(
            '/api/v1/stats/point',
            {
                point: {
                    pointId: point._id,
                    gameId,
                    pullingTeam: point.pullingTeam,
                    receivingTeam: point.receivingTeam,
                    scoringTeam: point.scoringTeam,
                    teamOnePlayers: point.teamOnePlayers,
                    teamTwoPlayers: point.teamTwoPlayers,
                    teamOneScore: point.teamOneScore,
                    teamTwoScore: point.teamTwoScore,
                    teamOneActions: actions,
                    teamTwoActions: [],
                },
            },
            'POST',
        )
    }

    return {
        perform,
        helpers: {
            parseGame,
            findOrCreateTournament,
            createGuests,
            reconcileGuests,
            reconcileGuestsOnGame,
            reconcileGuestsOnPoints,
            reconcileGuestsOnActions,
            uploadPoints,
            createPoint,
            createActions,
            createStatsGame,
            createStatsPoint,
        },
    }
}

export type FullGame = ReturnType<typeof fullGame>
