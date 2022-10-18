import * as Constants from '../../utils/constants'
import { IGameModel } from '../../models/game'
import IGame, { CreateGame, UpdateGame, updateGameKeys } from '../../types/game'
import { ApiError } from '../../types/errors'
import randomstring from 'randomstring'
import { Player, TeamNumber, TeamNumberString } from '../../types/ultmt'
import { findByIdOrThrow } from '../../utils/mongoose'
import { authenticateManager, getTeam } from '../../utils/ultmt'
import { IPointModel } from '../../models/point'
import { IActionModel } from '../../models/action'
import { Types } from 'mongoose'

export default class GameServices {
    gameModel: IGameModel
    pointModel: IPointModel
    actionModel: IActionModel
    ultmtUrl: string
    apiKey: string

    constructor(
        gameModel: IGameModel,
        pointModel: IPointModel,
        actionModel: IActionModel,
        ultmtUrl: string,
        apiKey: string,
    ) {
        this.gameModel = gameModel
        this.pointModel = pointModel
        this.actionModel = actionModel
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
        const user = await authenticateManager(this.ultmtUrl, this.apiKey, userJwt, gameData.teamOne._id?.toString())

        const safeData: CreateGame = {
            creator: gameData.creator,
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
        }

        const teamOne = await getTeam(this.ultmtUrl, this.apiKey, safeData.teamOne._id?.toString())

        let teamTwo
        if (safeData.teamTwoDefined) {
            teamTwo = await getTeam(this.ultmtUrl, this.apiKey, safeData.teamTwo._id?.toString())
        }

        const game = await this.gameModel.create({
            ...safeData,
            creator: user,
            teamOnePlayers: teamOne.players,
            teamTwoPlayers: safeData.teamTwoDefined ? teamTwo?.players : [],
            resolveCode: randomstring.generate({ length: 6, charset: 'numeric' }),
        })

        const token = game.getToken('one')

        return { game, token }
    }

    /**
     * Method to update a game
     * @param gameId id of game
     * @param data edited data
     * @returns updated game
     */
    updateGame = async (gameId: string, gameData: UpdateGame): Promise<IGame> => {
        const game = await findByIdOrThrow<IGame>(gameId, this.gameModel, Constants.UNABLE_TO_FIND_GAME)

        // This does not actually work b/c of 0's
        const safeData: UpdateGame = {
            teamTwo: gameData.teamTwo,
            teamTwoDefined: gameData.teamTwoDefined,
            scoreLimit: gameData.scoreLimit,
            halfScore: gameData.halfScore,
            startTime: gameData.startTime,
            softcapMins: gameData.softcapMins,
            hardcapMins: gameData.hardcapMins,
            playersPerPoint: gameData.playersPerPoint,
            timeoutPerHalf: gameData.timeoutPerHalf,
            floaterTimeout: gameData.floaterTimeout,
            tournament: gameData.tournament,
        }

        for (const key of updateGameKeys) {
            if (safeData[key] === undefined) {
                delete safeData[key]
            }
        }

        let teamTwo
        if (safeData.teamTwoDefined && game.teamTwoPlayers.length === 0) {
            teamTwo = await getTeam(this.ultmtUrl, this.apiKey, safeData.teamTwo?._id?.toString())
        }

        await game.updateOne({ ...safeData, teamTwoPlayers: teamTwo?.players || [] }, { omitUndefined: true })
        const updatedGame = await this.gameModel.findById(game._id)

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
        const game = await findByIdOrThrow<IGame>(gameId, this.gameModel, Constants.UNABLE_TO_FIND_GAME)
        await authenticateManager(this.ultmtUrl, this.apiKey, userJwt, teamId)

        if (!game?.teamTwo._id?.equals(teamId)) {
            throw new ApiError(Constants.UNAUTHENTICATED_USER, 401)
        }

        if (otp !== game.resolveCode) {
            throw new ApiError(Constants.WRONG_RESOLVE_CODE, 401)
        }

        const token = game.getToken('two')
        game.teamTwoActive = true
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
        const game = await findByIdOrThrow<IGame>(gameId, this.gameModel, Constants.UNABLE_TO_FIND_GAME)

        const playerData = {
            firstName: player.firstName,
            lastName: player.lastName,
            _id: undefined,
            username: 'guest',
        }
        if (team === TeamNumber.ONE) {
            game.teamOnePlayers.push(playerData)
        } else if (game.teamTwoActive) {
            game.teamTwoPlayers.push(playerData)
        } else {
            throw new ApiError(Constants.UNABLE_TO_ADD_PLAYER, 400)
        }

        await game.save()

        return game
    }

    /**
     * Method to finish a game
     * @param gameId id of game to finish
     * @param team team requesting finish
     * @returns updated game
     */
    finishGame = async (gameId: string, team: TeamNumber): Promise<IGame> => {
        const game = await findByIdOrThrow<IGame>(gameId, this.gameModel, Constants.UNABLE_TO_FIND_GAME)

        if (team === TeamNumber.ONE) {
            game.teamOneActive = false
        } else if (team === TeamNumber.TWO) {
            game.teamTwoActive = false
        }

        await game.save()

        return game
    }

    /**
     * Method to reactivate a game that has been finished or delayed
     * @param gameId id of game to reactivate
     * @param userJwt user to validate as team manager
     * @param teamId team that is in game
     * @returns new token and updated game
     */
    reactivateGame = async (
        gameId: string,
        userJwt: string,
        teamId: string,
    ): Promise<{ game: IGame; token: string }> => {
        const game = await findByIdOrThrow<IGame>(gameId, this.gameModel, Constants.UNABLE_TO_FIND_GAME)

        let team: TeamNumberString = 'one'
        if (game.teamOne._id?.equals(teamId) && !game.teamTwo._id?.equals(teamId)) {
            team = 'one'
        } else if (game.teamTwo._id?.equals(teamId)) {
            team = 'two'
        } else {
            throw new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 40)
        }

        await authenticateManager(this.ultmtUrl, this.apiKey, userJwt, teamId)

        const token = game.getToken(team)
        if (team === 'one') {
            game.teamOneActive = true
        } else {
            game.teamTwoActive = true
        }
        await game.save()

        return { game, token }
    }

    /**
     * Method to delete a game. Does not simply delete game,
     * but correctly handles behavior if other team is resolved.
     * @param gameId id of game to delete
     * @param userJwt jwt of deleting user
     * @param teamId team of deleting user
     */
    deleteGame = async (gameId: string, userJwt: string, teamId: string): Promise<void> => {
        const game = await findByIdOrThrow<IGame>(gameId, this.gameModel, Constants.UNABLE_TO_FIND_GAME)
        await authenticateManager(this.ultmtUrl, this.apiKey, userJwt, teamId)

        // get all points for this game
        const points = await this.pointModel.find().where('_id').in(game.points)
        // dereference all points for this team
        for (const point of points) {
            if (point.receivingTeam._id?.equals(teamId)) {
                point.receivingTeam._id = undefined
                point.receivingTeam.teamname = undefined
            } else if (point.pullingTeam._id?.equals(teamId)) {
                point.pullingTeam._id = undefined
                point.pullingTeam.teamname = undefined
            }
            if (point.scoringTeam?._id?.equals(teamId)) {
                point.scoringTeam._id = undefined
                point.scoringTeam.teamname = undefined
            }
            await point.save()
        }
        // if team one calling delete
        if (game.teamOne._id?.equals(teamId)) {
            // delete all team one actions
            const actionIds = points.reduce(
                (prev: Types.ObjectId[], current) => prev.concat(current.teamOneActions),
                [],
            )
            await this.actionModel.deleteMany().where('_id').in(actionIds)

            // remove team one action ids from point
            for (const point of points) {
                point.teamOneActions = []
                await point.save()
            }

            // 'dereference' team if the other team is defined
            if (game.teamTwoDefined) {
                game.teamOne._id = undefined
                game.teamOne.teamname = undefined
                await game.save()
            } else {
                // fully delete game if team two is not defined
                await this.pointModel.deleteMany().where('_id').in(game.points)
                await game.delete()
            }
        } else if (game.teamTwo._id?.equals(teamId)) {
            // just 'dereference' team since the other team definitely exists
            game.teamTwo._id = undefined
            game.teamTwo.teamname = undefined
            const actionIds = points.reduce(
                (prev: Types.ObjectId[], current) => prev.concat(current.teamTwoActions),
                [],
            )
            await this.actionModel.deleteMany().where('_id').in(actionIds)

            for (const point of points) {
                point.teamTwoActions = []
                await point.save()
            }

            await game.save()
        }
    }
}
