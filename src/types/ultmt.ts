import { Types } from 'mongoose'

export interface Player {
    _id?: Types.ObjectId
    firstName: string
    lastName: string
    username?: string
}

export interface Team {
    _id?: Types.ObjectId
    place?: string
    name: string
    teamname?: string
    seasonStart?: Date
    seasonEnd?: Date
}

export enum TeamNumber {
    ONE = 'one',
    TWO = 'two',
}
