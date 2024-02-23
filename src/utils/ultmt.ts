import * as Constants from './constants'
import axios from 'axios'
import { Player, TeamResponse, UserResponse } from '../types/ultmt'
import { ApiError } from '../types/errors'

export const getUser = async (ultmtUrl: string, apiKey: string, jwt: string): Promise<UserResponse> => {
    try {
        const response = await axios.get(`${ultmtUrl}/api/v1/user/me`, {
            headers: { 'X-API-Key': apiKey, Authorization: `Bearer ${jwt}` },
        })
        if (response.status !== 200) {
            throw new ApiError(Constants.UNAUTHENTICATED_USER, 401)
        }
        return response.data.user
    } catch (_error) {
        throw new ApiError(Constants.UNAUTHENTICATED_USER, 401)
    }
}

export const authenticateManager = async (
    ultmtUrl: string,
    apiKey: string,
    jwt?: string,
    teamId?: string,
): Promise<UserResponse> => {
    if (!jwt || !teamId) {
        throw new ApiError(Constants.UNAUTHENTICATED_USER, 401)
    }

    try {
        const response = await axios.get(`${ultmtUrl}/api/v1/auth/manager?team=${teamId}`, {
            headers: { 'X-API-Key': apiKey, Authorization: `Bearer ${jwt}` },
        })

        if (response.status === 401) {
            throw new ApiError(Constants.UNAUTHENTICATED_USER, 401)
        }
        const { user } = response.data
        return user
    } catch (error) {
        throw new ApiError(Constants.UNAUTHENTICATED_USER, 401)
    }
}

export const getTeam = async (ultmtUrl: string, apiKey: string, teamId?: string): Promise<TeamResponse> => {
    if (!teamId) {
        throw new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 404)
    }
    try {
        const response = await axios.get(`${ultmtUrl}/api/v1/team/${teamId}`, {
            headers: { 'X-API-Key': apiKey },
        })
        if (response.status !== 200) {
            throw new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 404)
        }
        const { team } = response.data
        return team
    } catch (error) {
        throw new ApiError(Constants.UNABLE_TO_FETCH_TEAM, 404)
    }
}

export const createGuest = async (
    ultmtUrl: string,
    apiKey: string,
    guestUser: { firstName: string; lastName: string },
    jwt?: string,
    teamId?: string,
): Promise<TeamResponse> => {
    if (!jwt || !teamId) {
        throw new ApiError(Constants.UNAUTHENTICATED_USER, 401)
    }

    try {
        const response = await axios.post(
            `${ultmtUrl}/api/v1/team/${teamId}/guest`,
            {
                ...guestUser,
            },
            { headers: { Authorization: `Bearer ${jwt}`, 'X-API-Key': apiKey } },
        )

        const { team } = response.data
        return team
    } catch (error) {
        throw new ApiError(Constants.UNABLE_TO_ADD_PLAYER, 401)
    }
}

export const parseUser = (player: Player): Player => {
    return {
        _id: player._id,
        firstName: player.firstName,
        lastName: player.lastName,
        username: player.username,
    }
}
