import * as Constants from '../../utils/constants'
import { IGameModel } from '../../models/game'
import Game, { CreateGame } from '../../types/game'
import { ApiError } from '../../types/errors'
import axios from 'axios'

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
    createGame = async (gameData: CreateGame, jwt: string): Promise<{ game: Game; token: string }> => {
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

        const teamOneResponse = await axios.get(`${this.ultmtUrl}/api/v1/team/${safeData.teamOne._id}`)
        if (teamOneResponse.status !== 200) {
            throw new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 404)
        }

        let teamTwoResponse
        if (safeData.teamTwoResolved) {
            teamTwoResponse = await axios.get(`${this.ultmtUrl}/api/v1/team/${safeData.teamTwo._id}`)
            if (teamTwoResponse.status !== 200) {
                throw new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 404)
            }
        }

        const game = await this.gameModel.create({
            ...safeData,
            creator: response.data.user,
            teamOnePlayers: teamOneResponse.data.team.players,
            teamTwoPlayers: safeData.teamTwoResolved ? teamTwoResponse?.data?.team.players : [],
        })

        return { game, token: game.token }
    }
}
