import * as Constants from '../../utils/constants'
import { ITournamentModel } from '../../models/tournament'
import ITournament, { CreateTournament } from '../../types/tournament'
import { findByIdOrThrow } from '../../utils/mongoose'
import { getUser, parseUser } from '../../utils/ultmt'

export default class TournamentServices {
    tournamentModel: ITournamentModel
    ultmtUrl: string
    apiKey: string

    constructor(tournamentModel: ITournamentModel, ultmtUrl: string, apiKey: string) {
        this.tournamentModel = tournamentModel
        this.ultmtUrl = ultmtUrl
        this.apiKey = apiKey
    }

    /**
     * Method to create a tournament
     * @param data create tournament data
     * @returns tournament document
     */
    createTournament = async (data: CreateTournament, jwt: string): Promise<ITournament> => {
        const user = await getUser(this.ultmtUrl, this.apiKey, jwt)
        const tournament = await this.tournamentModel.create({ ...data, creator: parseUser(user) })
        return tournament
    }

    /**
     * Method to get a tournament by id
     * @param id id of tournament
     * @returns tournament document
     */
    getTournament = async (id: string): Promise<ITournament> => {
        const tournament = await findByIdOrThrow<ITournament>(
            id,
            this.tournamentModel,
            Constants.UNABLE_TO_FIND_TOURNAMENT,
        )

        return tournament
    }

    /**
     * Method to search tounaments
     * @param q search query
     * @returns array of tournaments
     */
    searchTournaments = async (q: string): Promise<ITournament[]> => {
        const tournaments = await this.tournamentModel.find({ $text: { $search: q } })
        tournaments.sort((a, b) => {
            const aTime = Math.abs(new Date().getTime() - (a.startDate?.getTime() || 0))
            const bTime = Math.abs(new Date().getTime() - (b.startDate?.getTime() || 0))
            return aTime - bTime
        })
        return tournaments
    }
}
