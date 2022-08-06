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
    createGame = async (gameData: CreateGame, jwt: string): Promise<Game> => {
        const response = await fetch(`${this.ultmtUrl}/api/v1/user/manager/authenticate?team=${gameData.teamOne._id}`, {
            headers: { 'X-API-Key': this.apiKey, Authorization: `Bearer ${jwt}` },
        })

        if (response.status === 401) {
            throw new ApiError('Unable to authenticate user', 401)
        }

        const safeData: CreateGame = {
            teamOne: gameData.teamOne,
            teamTwo: gameData.teamTwo,
            teamTwoResolved: gameData.teamTwoResolved,
            scoreLimit: gameData.scoreLimit,
            startTime: gameData.startTime,
            softcapMins: gameData.softcapMins,
            hardcapMins: gameData.hardcapMins,
            liveGame: gameData.liveGame,
            playersPerPoint: gameData.playersPerPoint,
            timeoutPerHalf: gameData.timeoutPerHalf,
            floaterTimeout: gameData.floaterTimeout,
        }

        const creator = await response.json()

        const game = await this.gameModel.create({ ...safeData, creator: creator.user })
        return game
    }
}
