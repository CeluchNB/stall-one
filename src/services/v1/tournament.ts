import * as Constants from '../../utils/constants'
import { ITournamentModel } from '../../models/tournament'
import { ApiError } from '../../types/errors'
import ITournament, { CreateTournament } from '../../types/tournament'

export default class TournamentServices {
    tournamentModel: ITournamentModel

    constructor(tournamentModel: ITournamentModel) {
        this.tournamentModel = tournamentModel
    }

    /**
     * Method to create a tournament
     * @param data create tournament data
     * @returns tournament document
     */
    createTournament = async (data: CreateTournament): Promise<ITournament> => {
        const tournament = await this.tournamentModel.create(data)
        return tournament
    }

    /**
     * Method to get a tournament by id
     * @param id id of tournament
     * @returns tournament document
     */
    getTournament = async (id: string): Promise<ITournament> => {
        const tournament = await this.tournamentModel.findById(id)
        if (!tournament) {
            throw new ApiError(Constants.UNABLE_TO_FIND_TOURNAMENT, 404)
        }

        return tournament
    }
}
