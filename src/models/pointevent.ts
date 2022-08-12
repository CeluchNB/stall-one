import { Schema, SchemaTypes, model } from 'mongoose'
import IPointEvent, { EventType } from '../types/pointevent'

const schema = new Schema<IPointEvent>({
    pointId: { type: SchemaTypes.ObjectId, required: true },
    eventNumber: { type: Number, required: true },
    eventType: { type: String, enum: Object.values(EventType) },
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

const PointEvent = model<IPointEvent>('PointEvent', schema)
export type IPointEventModel = typeof PointEvent
export default PointEvent
