import * as Constants from '../../utils/constants'
import Game, { IGameModel } from '../../models/game'
import IGame, { CreateGame, UpdateGame, updateGameKeys } from '../../types/game'
import { ApiError } from '../../types/errors'
import axios from 'axios'
import randomstring from 'randomstring'
import jwt from 'jsonwebtoken'
import { Player, TeamNumber } from '../../types/ultmt'

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
     * @param userJwt user's jwt
     * @returns new game value
     */
    createGame = async (gameData: CreateGame, userJwt: string): Promise<{ game: IGame; token: string }> => {
        const response = await axios.get(
            `${this.ultmtUrl}/api/v1/user/manager/authenticate?team=${gameData.teamOne._id}`,
            {
                headers: { 'X-API-Key': this.apiKey, Authorization: `Bearer ${userJwt}` },
            },
        )

        if (response.status === 401) {
            throw new ApiError(Constants.UNAUTHENTICATED_USER, 401)
        }

        const safeData: CreateGame = {
            creator: gameData.creator,
            teamOne: gameData.teamOne,
            teamTwo: gameData.teamTwo,
            teamTwoDefined: gameData.teamTwoDefined,
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
        if (safeData.teamTwoDefined) {
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
            teamTwoPlayers: safeData.teamTwoDefined ? teamTwoResponse?.data?.team.players : [],
            resolveCode: randomstring.generate({ length: 6, charset: 'numeric' }),
        })

        const payload = {
            sub: game._id.toString(),
            iat: Date.now(),
            team: 'one',
        }

        const token = jwt.sign(payload, process.env.JWT_SECRET as string)
        game.teamOneToken = token
        await game.save()

        return { game, token: game.teamOneToken }
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
            throw new ApiError(Constants.UNABLE_TO_FIND_GAME, 404)
        }

        // This does not actually work b/c of 0's
        const safeData: UpdateGame = {
            teamTwo: gameData.teamTwo,
            teamTwoDefined: gameData.teamTwoDefined,
            scoreLimit: gameData.scoreLimit,
            startTime: gameData.startTime,
            softcapMins: gameData.softcapMins,
            hardcapMins: gameData.hardcapMins,
            liveGame: gameData.liveGame,
            playersPerPoint: gameData.playersPerPoint,
            timeoutPerHalf: gameData.timeoutPerHalf,
            floaterTimeout: gameData.floaterTimeout,
        }

        for (const key of updateGameKeys) {
            if (safeData[key] === undefined) {
                delete safeData[key]
            }
        }

        let teamTwoResponse
        if (safeData.teamTwoDefined && game.teamTwoPlayers.length === 0) {
            teamTwoResponse = await axios.get(`${this.ultmtUrl}/api/v1/team/${safeData.teamTwo?._id}`, {
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

    /**
     * Method to allow teamTwo to join game
     * @param gameId id of game
     * @param teamId id of team two
     * @param userJwt jwt of team two's manager
     * @param otp code to compare to resolveCode
     * @returns game token to team 2 manager
     */
    teamTwoJoinGame = async (
        gameId: string,
        teamId: string,
        userJwt: string,
        otp: string,
    ): Promise<{ game: IGame; token: string }> => {
        const game = await this.gameModel.findById(gameId)
        if (!game) {
            throw new ApiError(Constants.UNABLE_TO_FIND_GAME, 404)
        }

        const response = await axios.get(`${this.ultmtUrl}/api/v1/user/manager/authenticate?team=${teamId}`, {
            headers: { 'X-API-Key': this.apiKey, Authorization: `Bearer ${userJwt}` },
        })

        if (response.status === 401 || game?.teamTwo._id?.toString() !== teamId) {
            throw new ApiError(Constants.UNAUTHENTICATED_USER, 401)
        }

        if (otp !== game.resolveCode) {
            throw new ApiError(Constants.WRONG_RESOLVE_CODE, 401)
        }

        const payload = {
            sub: game._id.toString(),
            iat: Date.now(),
            team: 'two',
        }

        const token = jwt.sign(payload, process.env.JWT_SECRET as string)
        game.teamTwoToken = token
        game.teamTwoResolved = true
        await game.save()

        return { game, token }
    }

    /**
     * Method to add a guest player to a team for a single game
     * @param gameId id of game
     * @param team team to add player to (either 'one' or 'two')
     * @param player data of player to add
     * @returns updated game object
     */
    addGuestPlayer = async (gameId: string, team: TeamNumber, player: Player): Promise<IGame> => {
        const game = await this.gameModel.findById(gameId)
        if (!game) {
            throw new ApiError(Constants.UNABLE_TO_FIND_GAME, 404)
        }

        const playerData = {
            firstName: player.firstName,
            lastName: player.lastName,
            _id: undefined,
            username: 'guest',
        }
        if (team === TeamNumber.ONE) {
            game.teamOnePlayers.push(playerData)
        } else if (game.teamTwoResolved) {
            game.teamTwoPlayers.push(playerData)
        } else {
            throw new ApiError(Constants.UNABLE_TO_ADD_PLAYER, 400)
        }

        await game.save()

        return game
    }
}
