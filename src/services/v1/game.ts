import * as Constants from '../../utils/constants'
import { IGameModel } from '../../models/game'
import Game, { CreateGame } from '../../types/game'
import { ApiError } from '../../types/errors'

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
        const response = await fetch(`${this.ultmtUrl}/api/v1/user/manager/authenticate?team=${gameData.teamOne._id}`, {
            headers: { 'X-API-Key': this.apiKey, Authorization: `Bearer ${jwt}` },
        })

        if (!response.ok) {
            throw new ApiError(Constants.UNAUTHENTICATED_USER, 401)
        }

        const creator = await response.json()
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

        const teamOneResponse = await fetch(`${this.ultmtUrl}/api/v1/team/${safeData.teamOne._id}`)
        if (!teamOneResponse.ok) {
            throw new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 404)
        }
        const teamOneData = await teamOneResponse.json()

        let teamTwoData
        if (safeData.teamTwoResolved) {
            const teamTwoResponse = await fetch(`${this.ultmtUrl}/api/v1/team/${safeData.teamTwo._id}`)
            if (!teamTwoResponse.ok) {
                throw new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 404)
            }
            teamTwoData = await teamTwoResponse.json()
        }

        const game = await this.gameModel.create({
            ...safeData,
            creator: creator.user,
            teamOnePlayers: teamOneData.team.players,
            teamTwoPlayers: safeData.teamTwoResolved ? teamTwoData.team.players : [],
        })

        return { game, token: game.token }
    }
}
