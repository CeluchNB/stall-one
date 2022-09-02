import { getDisplayMessage, parseActionData } from '../../../src/utils/action'
import { Types } from 'mongoose'
import { ActionType } from '../../../src/types/action'

describe('test get display message', () => {
    it('with pull', () => {
        const message = getDisplayMessage(ActionType.PULL, {
            _id: new Types.ObjectId(),
            firstName: 'Noah',
            lastName: 'Celuch',
            username: 'noah',
        })
        expect(message).toBe('Noah Celuch pulls the disc')
    })

    it('with catch', () => {
        const message = getDisplayMessage(
            ActionType.CATCH,
            {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noahc',
            },
            {
                _id: new Types.ObjectId(),
                firstName: 'Amy',
                lastName: 'Celuch',
                username: 'amyc',
            },
        )
        expect(message).toBe('Noah Celuch throws to Amy Celuch')
    })

    it('with default', () => {
        const message = getDisplayMessage(ActionType.CALL_ON_FIELD)
        expect(message).toBe('An action occurred')
    })
})

describe('test parse action data', () => {
    it('with valid data', () => {
        const action = parseActionData(
            {
                actionType: ActionType.PULL,
                pointId: '123456acdeb847392ed0947a',
                team: {
                    name: 'test name',
                },
                tags: ['good'],
            },
            2,
        )
        expect(action.pointId.toString()).toBe('123456acdeb847392ed0947a')
        expect(action.tags[0]).toBe('good')
        expect(action.actionType).toBe(ActionType.PULL)
        expect(action.comments.length).toBe(0)
        expect(action.actionNumber).toBe(2)
    })
})
