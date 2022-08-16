import * as Constants from '../../utils/constants'
import Game, { IGameModel } from '../../models/game'
import IGame, { CreateGame, UpdateGame } from '../../types/game'
import { ApiError } from '../../types/errors'
import axios from 'axios'
import randomstring from 'randomstring'

export default class GameServices {
    gameModel: IGameModel
    ultmtUrl: string
    apiKey: string

    constructor(gameModel: IGameModel, ultmtUrl: string, apiKey: string) {
        this.gameModel = gameModel
        this.ultmtUrl = ultmtUrl
        this.apiKey = apiKey
    }

    /**
     * Method to create a game
     * @param gameData initial data to create game
     * @param jwt user's jwt
     * @returns new game value
     */
    createGame = async (gameData: CreateGame, jwt: string): Promise<{ game: IGame; token: string }> => {
        const response = await axios.get(
            `${this.ultmtUrl}/api/v1/user/manager/authenticate?team=${gameData.teamOne._id}`,
            {
                headers: { 'X-API-Key': this.apiKey, Authorization: `Bearer ${jwt}` },
            },
        )

        if (response.status === 401) {
            throw new ApiError(Constants.UNAUTHENTICATED_USER, 401)
        }

        const safeData: CreateGame = {
            teamOne: gameData.teamOne,
            teamTwo: gameData.teamTwo,
            teamTwoResolved: gameData.teamTwoResolved,
            scoreLimit: gameData.scoreLimit,
            startTime: new Date(gameData.startTime),
            softcapMins: gameData.softcapMins,
            hardcapMins: gameData.hardcapMins,
            liveGame: gameData.liveGame,
            playersPerPoint: gameData.playersPerPoint,
            timeoutPerHalf: gameData.timeoutPerHalf,
            floaterTimeout: gameData.floaterTimeout,
        }

        const teamOneResponse = await axios.get(`${this.ultmtUrl}/api/v1/team/${safeData.teamOne._id}`, {
            headers: { 'X-API-Key': this.apiKey },
        })
        if (teamOneResponse.status !== 200) {
            throw new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 404)
        }

        let teamTwoResponse
        if (safeData.teamTwoResolved) {
            teamTwoResponse = await axios.get(`${this.ultmtUrl}/api/v1/team/${safeData.teamTwo._id}`, {
                headers: { 'X-API-Key': this.apiKey },
            })
            if (teamTwoResponse.status !== 200) {
                throw new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 404)
            }
        }

        const game = await this.gameModel.create({
            ...safeData,
            creator: response.data.user,
            teamOnePlayers: teamOneResponse.data.team.players,
            teamTwoPlayers: safeData.teamTwoResolved ? teamTwoResponse?.data?.team.players : [],
            resolveCode: randomstring.generate({ length: 6, charset: 'numeric' }),
        })

        return { game, token: game.token }
    }

    /**
     * Method to update a game
     * @param gameId id of game
     * @param data edited data
     * @returns updated game
     */
    updateGame = async (gameId: string, gameData: UpdateGame): Promise<IGame> => {
        const game = await this.gameModel.findById(gameId)
        if (!game) {
            throw new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 404)
        }

        // This does not actually work b/c of 0's
        const safeData: UpdateGame = {
            teamTwo: gameData.teamTwo || game.teamTwo,
            teamTwoResolved: gameData.teamTwoResolved || game.teamTwoResolved,
            scoreLimit: gameData.scoreLimit || game.scoreLimit,
            startTime: gameData.startTime ? new Date(gameData.startTime) : game.startTime,
            softcapMins: gameData.softcapMins || game.softcapMins,
            hardcapMins: gameData.hardcapMins || game.hardcapMins,
            liveGame: gameData.liveGame || game.liveGame,
            playersPerPoint: gameData.playersPerPoint || game.playersPerPoint,
            timeoutPerHalf: gameData.timeoutPerHalf || game.timeoutPerHalf,
            floaterTimeout: gameData.floaterTimeout || game.floaterTimeout,
        }

        if (gameData.teamTwoResolved === false) {
            safeData.teamTwoResolved = false
        }

        if (gameData.liveGame === false) {
            safeData.liveGame = false
        }

        if (gameData.floaterTimeout === false) {
            safeData.floaterTimeout = false
        }

        let teamTwoResponse
        if (safeData.teamTwoResolved && game.teamTwoPlayers.length === 0) {
            teamTwoResponse = await axios.get(`${this.ultmtUrl}/api/v1/team/${safeData.teamTwo._id}`, {
                headers: { 'X-API-Key': this.apiKey },
            })
            if (teamTwoResponse.status !== 200) {
                throw new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 404)
            }
        }

        await game.updateOne(
            { ...safeData, teamTwoPlayers: teamTwoResponse?.data.team.players },
            { omitUndefined: true },
        )
        const updatedGame = await Game.findById(game._id)

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return updatedGame!
    }
}
