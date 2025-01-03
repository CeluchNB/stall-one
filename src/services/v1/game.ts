import * as Constants from '../../utils/constants'
import Game, { IGameModel } from '../../models/game'
import IGame, { CreateFullGame, CreateGame, GameStatus, UpdateGame, updateGameKeys } from '../../types/game'
import { ApiError } from '../../types/errors'
import randomstring from 'randomstring'
import { Player, TeamNumber, TeamNumberString, UserResponse } from '../../types/ultmt'
import { findByIdOrThrow } from '../../utils/mongoose'
import { authenticateManager, getTeam, parseUser } from '../../utils/ultmt'
import { IPointModel } from '../../models/point'
import { IActionModel } from '../../models/action'
import { FilterQuery, Types } from 'mongoose'
import IPoint, { PointStatus } from '../../types/point'
import { sendCloudTask } from '../../utils/cloud-tasks'
import IAction from '../../types/action'
import { ITournamentModel } from '../../models/tournament'
import { getTeamTwoStatus } from '../../utils/game'
import { pointIsActive } from '../../utils/point'
import { getClient } from '../../utils/redis'

export default class GameServices {
    gameModel: IGameModel
    pointModel: IPointModel
    actionModel: IActionModel
    tournamentModel: ITournamentModel
    ultmtUrl: string
    apiKey: string

    constructor(
        gameModel: IGameModel,
        pointModel: IPointModel,
        actionModel: IActionModel,
        tournamentModel: ITournamentModel,
        ultmtUrl: string,
        apiKey: string,
    ) {
        this.gameModel = gameModel
        this.pointModel = pointModel
        this.actionModel = actionModel
        this.tournamentModel = tournamentModel
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

        await this.findOrCreateTournament(safeData, user)

        const teamOne = await getTeam(this.ultmtUrl, this.apiKey, safeData.teamOne._id?.toString())

        let teamTwo
        if (safeData.teamTwoDefined) {
            teamTwo = await getTeam(this.ultmtUrl, this.apiKey, safeData.teamTwo._id?.toString())
        }

        const game: IGame = await this.gameModel.create({
            ...safeData,
            creator: user,
            teamOnePlayers: teamOne.players,
            teamTwoPlayers: safeData.teamTwoDefined ? teamTwo?.players : [],
            resolveCode: randomstring.generate({ length: 6, charset: 'numeric' }),
            teamOneStatus: GameStatus.ACTIVE,
            teamTwoStatus: safeData.teamTwoDefined ? GameStatus.DEFINED : GameStatus.GUEST,
        })

        const token = game.getToken('one')
        await createStatsGame(game)

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

        // TODO: This does not actually work b/c of 0's
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
        game.teamTwoStatus = GameStatus.ACTIVE
        game.teamTwoJoined = true
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
            _id: new Types.ObjectId(),
            username: 'guest',
        }
        if (team === TeamNumber.ONE) {
            game.teamOnePlayers.push(playerData)
        } else if (game.teamTwoStatus === GameStatus.ACTIVE) {
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
            game.teamOneStatus = GameStatus.COMPLETE
        } else if (team === TeamNumber.TWO) {
            game.teamTwoActive = false
            game.teamTwoStatus = GameStatus.COMPLETE
        }

        await game.save()
        const points = await this.pointModel.find({ gameId })
        await sendCloudTask(`/api/v1/stats/game/finish/${gameId}`, { pointTotal: points.length }, 'PUT')

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

        let team: TeamNumberString
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
            game.teamOneStatus = GameStatus.ACTIVE
        } else {
            game.teamTwoActive = true
            game.teamTwoStatus = GameStatus.ACTIVE
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
        const points = await this.pointModel.find({ gameId })
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

        const livePointIds = points
            .filter((p) => p.teamOneStatus === PointStatus.ACTIVE || p.teamTwoStatus === PointStatus.ACTIVE)
            .map((p) => p._id.toHexString())

        const pointIds = points.map((p) => p._id)
        // if team one calling delete
        if (game.teamOne._id?.equals(teamId)) {
            // delete all team one actions
            await this.actionModel.deleteMany({ pointId: { $in: pointIds }, 'team._id': teamId })

            // 'dereference' team if the other team is joined
            if (game.teamTwoJoined) {
                game.teamOne._id = undefined
                game.teamOne.teamname = undefined
                await game.save()
            } else {
                // fully delete game if team two is not defined
                await this.deletePointRedisKeys(livePointIds)
                await this.pointModel.deleteMany({ gameId })
                await game.deleteOne()
            }
        } else if (game.teamTwo._id?.equals(teamId)) {
            // delete actions
            await this.actionModel.deleteMany({ pointId: { $in: pointIds }, 'team._id': teamId })

            // undefined team one _id means team one has already deleted
            if (!game.teamOne._id) {
                await this.deletePointRedisKeys(livePointIds)
                await this.pointModel.deleteMany({ gameId })
                await game.deleteOne()
            } else {
                game.teamTwo._id = undefined
                game.teamTwo.teamname = undefined
                game.teamTwoJoined = false
                await game.save()
            }
        }
        await sendCloudTask(`/api/v1/stats/game/delete/${gameId}?team=${teamId}`, {}, 'PUT')
    }

    /**
     * Method to get a game by id.
     * @param gameId id of game to get
     * @returns game
     */
    getGame = async (gameId: string): Promise<IGame> => {
        const game = await findByIdOrThrow<IGame>(gameId, this.gameModel, Constants.UNABLE_TO_FIND_GAME)
        return game
    }

    /**
     * Method to get all points of a game
     * @param gameId id of game to get points for
     * @returns array of points
     */
    getPointsByGame = async (gameId: string): Promise<IPoint[]> => {
        const points = await this.pointModel.find({ gameId })
        return points
    }

    /**
     * Method to search games by text query, live, and date parameters
     * @param q search query
     * @param live live game boolean
     * @param after games starting after this time
     * @param before games ending after this time
     * @returns array of games
     */
    searchGames = async (
        q?: string,
        live?: boolean,
        after?: Date,
        before?: Date,
        pageSize = 10,
        offset = 0,
    ): Promise<IGame[]> => {
        const filter: FilterQuery<IGame> = {}
        if (q) {
            const terms = q.split(' ')
            const regexes = terms.map((t) => {
                if (t.length >= 3) {
                    return new RegExp(`^${t}`, 'i')
                }
            })
            const tests: { [x: string]: { $regex: RegExp } }[] = []
            for (const r of regexes) {
                if (r) {
                    tests.push({ 'teamOne.place': { $regex: r } })
                    tests.push({ 'teamOne.teamname': { $regex: r } })
                    tests.push({ 'teamOne.name': { $regex: r } })
                    tests.push({ 'teamTwo.place': { $regex: r } })
                    tests.push({ 'teamTwo.name': { $regex: r } })
                    tests.push({ 'teamTwo.teamname': { $regex: r } })
                    tests.push({ 'tournament.name': { $regex: r } })
                    tests.push({ 'tournament.eventId': { $regex: r } })
                }
            }
            if (tests.length > 0) {
                filter.$or = [...(filter.$or || []), ...tests]
            }
        }
        if (live !== undefined && live !== null) {
            if (live) {
                filter['$and'] = [{ $or: [{ teamOneStatus: GameStatus.ACTIVE }, { teamTwoStatus: GameStatus.ACTIVE }] }]
            } else {
                filter['$and'] = [
                    { teamOneStatus: GameStatus.COMPLETE },
                    { teamTwoStatus: { $not: { $eq: GameStatus.ACTIVE } } },
                ]
            }
        }
        if (after) {
            filter['startTime'] = { $gte: after }
        }
        if (before) {
            filter['startTime'] = { ...filter['startTime'], $lt: before }
        }

        // search with no parameters (use case: home screen) should filter out low scoring games (which are usually test games)
        if (!q && !before && !after && (live === undefined || live === null)) {
            filter.$and = [...(filter.$and || []), { $or: [{ teamOneScore: { $gte: 2 } }, { teamTwoScore: { $gte: 2 } }] }]
        }

        const games = await this.gameModel.find(filter).sort({ startTime: -1 }).skip(offset).limit(pageSize)

        return games
    }

    /**
     * Method to get all games a team is associated with
     * @param teamId id of team
     * @returns array of games belonging to teams
     */
    getGamesByTeamId = async (teamId: string): Promise<IGame[]> => {
        if (!Types.ObjectId.isValid(teamId)) {
            return []
        }
        const id = new Types.ObjectId(teamId)
        const games = await this.gameModel.find().or([{ 'teamOne._id': id }, { 'teamTwo._id': id }])
        return games
    }

    /**
     * Method to create a full game if the game cannot be created live for any reason.
     * @param gameData full game data
     * @param userJwt creating user's jwt
     * @returns game object
     */
    createFullGame = async (gameData: CreateFullGame, userJwt: string): Promise<IGame> => {
        const user = await authenticateManager(this.ultmtUrl, this.apiKey, userJwt, gameData.teamOne._id?.toString())
        const safeData = {
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
            teamOneActive: false,
            teamTwoActive: false,
            teamOneStatus: GameStatus.COMPLETE,
            teamTwoStatus: getTeamTwoStatus(gameData),
        }

        await this.findOrCreateTournament(safeData, user)

        const game = await this.gameModel.create(safeData)
        await createStatsGame(game)

        const points = gameData.points
        for (const p of points) {
            const point = await this.pointModel.create({
                ...p,
                teamOneActive: false,
                teamTwoActive: false,
                teamOneStatus: PointStatus.COMPLETE,
                teamTwoStatus: PointStatus.FUTURE,
                gameId: game._id,
            })
            const actions: IAction[] = []
            for (const [i, a] of p.actions.entries()) {
                const action = await this.actionModel.create({
                    ...a,
                    pointId: point._id,
                    actionNumber: i + 1,
                    team: gameData.teamOne,
                })
                actions.push(action)
            }
            await point.save()
            await createStatsPoint(point, game._id.toHexString(), actions)
        }

        await game.save()
        await sendCloudTask(`/api/v1/stats/game/finish/${game._id}`, { pointTotal: points.length }, 'PUT')
        return game
    }

    /**
     * Method to increment game views. Logic on when to send will be determined on the frontend
     * @param gameId id of game to increment total views
     */
    open = async (gameId: string): Promise<IGame> => {
        const game = await Game.findOneAndUpdate({ _id: gameId }, { $inc: { totalViews: 1 } }, { new: true })
        if (!game) {
            throw new ApiError(Constants.UNABLE_TO_FIND_GAME, 404)
        }
        return game
    }

    /**
     * Method to completely rebuild the stats for a game
     * @param gameId game id to rebuild
     * @param teamId team to rebuild game for
     */
    rebuildStatsForGame = async (gameId: string, teamId: string) => {
        const game = await this.gameModel.findById(gameId)
        if (!game) {
            throw new ApiError(Constants.UNABLE_TO_FIND_GAME, 404)
        }

        if (!game.teamOne._id?.equals(teamId) && !game.teamTwo._id?.equals(teamId)) {
            throw new ApiError(Constants.INVALID_DATA, 400)
        }

        await createStatsGame(game)

        const points = await this.pointModel.find({ gameId })
        for (const point of points) {
            if (pointIsActive(point)) continue

            const actions = await this.actionModel.find({ pointId: point._id, 'team._id': teamId })
            await createStatsPoint(point, gameId, actions)
        }

        if (game.teamOneStatus !== GameStatus.ACTIVE && game.teamTwoStatus !== GameStatus.ACTIVE) {
            await sendCloudTask(`/api/v1/stats/game/finish/${gameId}`, { pointTotal: points.length }, 'PUT')
        }
    }

    /**
     * Method to update players on a game based on a team's players in ultmt-api microservice
     * @param gameId id of game
     * @param team team to add player to (either 'one' or 'two')
     * @param player data of player to add
     * @returns updated game object
     */
    updateGamePlayers = async (gameId: string, teamNumber: TeamNumber): Promise<IGame> => {
        const game = await findByIdOrThrow<IGame>(gameId, this.gameModel, Constants.UNABLE_TO_FIND_GAME)

        const teamId = teamNumber === TeamNumber.ONE ? game.teamOne._id : game.teamTwo._id
        const team = await getTeam(this.ultmtUrl, this.apiKey, teamId?.toHexString())

        if (teamNumber === TeamNumber.ONE) {
            game.teamOnePlayers = team.players
        } else if (game.teamTwoStatus === GameStatus.ACTIVE) {
            game.teamTwoPlayers = team.players
        } else {
            throw new ApiError(Constants.UNABLE_TO_ADD_PLAYER, 400)
        }

        await game.save()

        return game
    }

    private findOrCreateTournament = async (data: CreateGame, user: UserResponse) => {
        if (data.tournament) {
            const tournament = await this.tournamentModel.findOne({ eventId: data.tournament.eventId })
            if (tournament) {
                data.tournament = tournament
            } else {
                const { name, eventId, startDate, endDate } = data.tournament
                const newTournament = await this.tournamentModel.create({
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

    private deletePointRedisKeys = async (pointIds: string[]) => {
        const redisClient = await getClient() // TODO: DI this

        for await (const key of redisClient.scanIterator()) {
            for (const pointId of pointIds) {
                if (key.includes(pointId)) {
                    await redisClient.del(key)
                }
            }
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
