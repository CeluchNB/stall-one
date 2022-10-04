import { ITournamentModel } from '../../models/tournament'
import ITournament, { CreateTournament } from '../../types/tournament'

export default class TournamentServices {
    tournamentModel: ITournamentModel

    constructor(tournamentModel: ITournamentModel) {
        this.tournamentModel = tournamentModel
    }

    createTournament = async (data: CreateTournament): Promise<ITournament> => {
        const tournament = await this.tournamentModel.create(data)
        return tournament
    }
}
