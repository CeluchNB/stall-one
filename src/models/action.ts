import { Schema, SchemaTypes, model } from 'mongoose'
import IAction, { ActionType } from '../types/action'

const schema = new Schema<IAction>({
    pointId: { type: SchemaTypes.ObjectId, required: true },
    eventNumber: { type: Number, required: true },
    eventType: { type: String, enum: Object.values(ActionType) },
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
    team: SchemaTypes.ObjectId,
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
