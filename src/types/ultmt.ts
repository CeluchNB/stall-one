import { Types } from 'mongoose'

export interface Player {
    _id?: Types.ObjectId
    firstName: string
    lastName: string
    username?: string
}

export interface UserResponse {
    _id: Types.ObjectId
    firstName: string
    lastName: string
    username: string
}

export interface Team {
    _id?: Types.ObjectId
    place?: string
    name: string
    teamname?: string
    seasonStart?: Date
    seasonEnd?: Date
}

export interface TeamResponse {
    _id: Types.ObjectId
    place: string
    name: string
    teamname: string
    seasonStart: Date
    seasonEnd: Date
    players: Player[]
}

export enum TeamNumber {
    ONE = 'one',
    TWO = 'two',
}

export type TeamNumberString = 'one' | 'two'
