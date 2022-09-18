import { Schema, SchemaTypes, model } from 'mongoose'
import IAction, { ActionType } from '../types/action'

const schema = new Schema<IAction>({
    actionNumber: { type: Number, required: true },
    actionType: { type: String, enum: Object.values(ActionType) },
    displayMessage: String,
    comments: [
        {
            user: {
                _id: SchemaTypes.ObjectId,
                firstName: String,
                lastName: String,
                username: String,
            },
            comment: String,
        },
    ],
    team: {
        type: {
            _id: SchemaTypes.ObjectId,
            place: String,
            name: String,
            teamname: String,
            seasonStart: Date,
            seasonEnd: Date,
        },
        required: true,
    },
    playerOne: {
        type: {
            _id: SchemaTypes.ObjectId,
            firstName: String,
            lastName: String,
            username: String,
        },
    },
    playerTwo: {
        type: {
            _id: SchemaTypes.ObjectId,
            firstName: String,
            lastName: String,
            username: String,
        },
    },
    tags: [String],
})

const Action = model<IAction>('Action', schema)
export type IActionModel = typeof Action
export default Action
