import * as Constants from '../../../utils/constants'
import IAction from '../../../types/action'
import Dependencies from '../../../types/di'
import { ApiError } from '../../../types/errors'
import IGame, { CreateFullGame, CreateGame, GameStatus } from '../../../types/game'
import IPoint, { PointStatus } from '../../../types/point'
import { Player, UserResponse } from '../../../types/ultmt'
import { sendCloudTask } from '../../../utils/cloud-tasks'
import { authenticateManager, createGuest, parseUser } from '../../../utils/ultmt'

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
        const guestMap = new Map<string, Player>()
        for (const player of safeData.teamOnePlayers) {
            if (player.localGuest) {
                const updatedTeam = await createGuest(ultmtUrl, apiKey, userJwt, teamId, player)
                guestMap.set(player._id.toString(), updatedTeam.players[updatedTeam.players.length - 1])
            }
        }

        // Upload points
        const points = gameData.points
        for (const p of points) {
            const point = await pointModel.create({
                ...p,
                teamOneActive: false,
                teamTwoActive: false,
                teamOneStatus: PointStatus.COMPLETE,
                teamTwoStatus: PointStatus.FUTURE,
                gameId: game._id,
            })
            const actions = []
            for (const [i, a] of p.actions.entries()) {
                const action = await actionModel.create({
                    ...a,
                    pointId: point._id,
                    actionNumber: i + 1,
                    team: gameData.teamOne,
                })
                actions.push(action)
                point.teamOneActions.push(action._id)
            }
            game.points.push(point._id)
            await point.save()
            await createStatsPoint(point, game._id.toHexString(), actions)
        }

        await game.save()
        await sendCloudTask(`/api/v1/stats/game/finish/${game._id}`, {}, 'PUT')
        return game
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
            findOrCreateTournament,
            createStatsGame,
            createStatsPoint,
        },
    }
}

export type FullGame = ReturnType<typeof fullGame>
