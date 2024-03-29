import { Types, Model, Document } from 'mongoose'
import { ApiError } from '../types/errors'

export const findByIdOrThrow = async <R>(
    id: string | Types.ObjectId,
    model: Model<R>,
    error: string,
): Promise<Document<unknown, unknown, R> & R> => {
    const doc = await model.findById(id)
    if (!doc) {
        throw new ApiError(error, 404)
    }
    return doc
}

export const idsAreEqual = (idOne: Types.ObjectId | undefined, idTwo: Types.ObjectId | string | undefined): boolean => {
    if (!idOne || !idTwo) {
        return false
    }

    return idOne.equals(idTwo)
}
