import * as Constants from '../../../src/utils/constants'
import { handleSubstitute, parseActionData, validateActionData } from '../../../src/utils/action'
import { Types } from 'mongoose'
import { ActionType, ClientAction } from '../../../src/types/action'
import { ApiError } from '../../../src/types/errors'
import { Player } from '../../../src/types/ultmt'
import { setUpDatabase, tearDownDatabase, resetDatabase, gameData, createPointData } from '../../fixtures/setup-db'
import Game from '../../../src/models/game'
import Point from '../../../src/models/point'

beforeAll(async () => {
    await setUpDatabase()
})

afterAll(async () => {
    await tearDownDatabase()
})

afterEach(async () => {
    await resetDatabase()
})

describe('test parse action data', () => {
    it('with valid data', () => {
        const action = parseActionData(
            {
                actionType: ActionType.PULL,
                tags: ['good'],
            },
            2,
            'one',
        )
        expect(action.tags[0]).toBe('good')
        expect(action.actionType).toBe(ActionType.PULL)
        expect(action.comments.length).toBe(0)
        expect(action.actionNumber).toBe(2)
        expect(action.teamNumber).toBe('one')
    })
})

const action: ClientAction = {
    playerOne: {
        _id: new Types.ObjectId(),
        firstName: 'First 1',
        lastName: 'Last 1',
        username: 'firstlast1',
    },
    playerTwo: {
        _id: new Types.ObjectId(),
        firstName: 'First 2',
        lastName: 'Last 2',
        username: 'firstlast2',
    },
    actionType: ActionType.PULL,
    tags: [],
}

const prevAction: ClientAction = {
    playerOne: {
        _id: new Types.ObjectId(),
        firstName: 'First 1',
        lastName: 'Last 1',
        username: 'firstlast1',
    },
    playerTwo: {
        _id: new Types.ObjectId(),
        firstName: 'First 2',
        lastName: 'Last 2',
        username: 'firstlast2',
    },
    actionType: ActionType.CATCH,
    tags: [],
}

const playerOne: Player = {
    _id: new Types.ObjectId(),
    firstName: 'First 1',
    lastName: 'Last 1',
    username: 'firstlast1',
}
const playerTwo: Player = {
    _id: new Types.ObjectId(),
    firstName: 'First 2',
    lastName: 'Last 2',
    username: 'firstlast2',
}
describe('test validate action data', () => {
    it('test valid initial action for pulling team', () => {
        action.playerTwo = undefined
        const result = validateActionData(action, true)
        expect(result).toBe(true)
    })

    it('test invalid initial action for pulling team', () => {
        action.actionType = ActionType.DROP
        expect(() => {
            validateActionData(action, true)
        }).toThrowError(new ApiError(Constants.INVALID_ACTION_TYPE, 400))
    })

    it('test valid initial data for receiving team', () => {
        action.actionType = ActionType.CATCH
        action.playerOne = playerOne
        action.playerTwo = playerTwo
        const result = validateActionData(action, false)
        expect(result).toBe(true)
    })

    it('test invalid initial data for receiving team', () => {
        action.actionType = ActionType.PULL
        action.playerOne = playerOne
        action.playerTwo = undefined
        expect(() => {
            validateActionData(action, false)
        }).toThrowError(new ApiError(Constants.INVALID_ACTION_TYPE, 400))
    })

    it('test valid offensive action', () => {
        action.actionType = ActionType.CATCH
        action.playerOne = playerOne
        action.playerTwo = playerTwo
        const result = validateActionData(action, true, prevAction)
        expect(result).toBe(true)
    })

    it('test invalid offensive action', () => {
        action.actionType = ActionType.CATCH
        action.playerOne = playerOne
        action.playerTwo = playerTwo
        prevAction.actionType = ActionType.PULL
        expect(() => {
            validateActionData(action, true, prevAction)
        }).toThrowError(new ApiError(Constants.INVALID_ACTION_TYPE, 400))
    })

    it('test valid defensive action', () => {
        action.actionType = ActionType.BLOCK
        action.playerOne = playerOne
        action.playerTwo = undefined
        prevAction.actionType = ActionType.PULL
        const result = validateActionData(action, true, prevAction)
        expect(result).toBe(true)
    })

    it('test invalid defensive action', () => {
        action.actionType = ActionType.PICKUP
        action.playerOne = playerOne
        prevAction.actionType = ActionType.CATCH
        expect(() => {
            validateActionData(action, true, prevAction)
        }).toThrowError(new ApiError(Constants.INVALID_ACTION_TYPE, 400))
    })

    it('with missing player on pull', () => {
        action.actionType = ActionType.PULL
        action.playerOne = undefined
        expect(() => {
            validateActionData(action, true)
        }).toThrowError(new ApiError(Constants.INVALID_DATA, 400))
    })

    it('with extra player on block', () => {
        action.actionType = ActionType.BLOCK
        action.playerOne = playerOne
        action.playerTwo = playerTwo
        prevAction.actionType = ActionType.PULL
        expect(() => {
            validateActionData(action, true, prevAction)
        }).toThrowError(new ApiError(Constants.INVALID_DATA, 400))
    })

    it('with missing player on catch', () => {
        action.actionType = ActionType.CATCH
        action.playerOne = undefined
        action.playerTwo = playerTwo
        prevAction.actionType = ActionType.CATCH
        expect(() => {
            validateActionData(action, true, prevAction)
        }).toThrowError(new ApiError(Constants.INVALID_DATA, 400))
    })

    it('with missing player one on substitution', () => {
        action.actionType = ActionType.SUBSTITUTION
        action.playerOne = undefined
        action.playerTwo = playerTwo
        prevAction.actionType = ActionType.PICKUP
        expect(() => {
            validateActionData(action, true, prevAction)
        }).toThrowError(new ApiError(Constants.INVALID_DATA, 400))
    })

    it('with missing player two on substitution', () => {
        action.actionType = ActionType.SUBSTITUTION
        action.playerOne = playerOne
        action.playerTwo = undefined
        prevAction.actionType = ActionType.PICKUP
        expect(() => {
            validateActionData(action, true, prevAction)
        }).toThrowError(new ApiError(Constants.INVALID_DATA, 400))
    })

    it('with no player one on drop', () => {
        action.actionType = ActionType.DROP
        action.playerOne = undefined
        action.playerTwo = playerTwo
        prevAction.actionType = ActionType.PICKUP
        expect(() => {
            validateActionData(action, true, prevAction)
        }).toThrowError(new ApiError(Constants.INVALID_DATA, 400))
    })

    it('with timeout', () => {
        action.actionType = ActionType.TIMEOUT
        action.playerOne = undefined
        action.playerTwo = undefined
        const result = validateActionData(action, true, prevAction)
        expect(result).toBe(true)
    })

    it('with call on field', () => {
        action.actionType = ActionType.CALL_ON_FIELD
        action.playerOne = undefined
        action.playerTwo = undefined
        const result = validateActionData(action, true, prevAction)
        expect(result).toBe(true)
    })
})

describe('test handle substitute', () => {
    it('with valid data for team one', async () => {
        const game = await Game.create(gameData)
        const point = await Point.create(createPointData)
        game.teamOne = createPointData.pullingTeam
        await game.save()

        const actionData: ClientAction = {
            actionType: ActionType.SUBSTITUTION,
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            playerTwo: {
                _id: new Types.ObjectId(),
                firstName: 'Amy',
                lastName: 'Celuch',
                username: 'amy',
            },
            tags: ['good'],
        }
        await handleSubstitute(actionData, point._id.toString(), 'one', Point)

        const updatedPoint = await Point.findById(point._id)
        expect(updatedPoint?.teamOnePlayers.length).toBe(1)
        expect(updatedPoint?.teamOnePlayers[0].username).toBe(actionData.playerTwo?.username)
        expect(updatedPoint?.teamTwoPlayers.length).toBe(0)
    })

    it('with valid data for team two', async () => {
        const game = await Game.create(gameData)
        const point = await Point.create(createPointData)
        game.teamOne = createPointData.pullingTeam
        await game.save()

        const actionData: ClientAction = {
            actionType: ActionType.SUBSTITUTION,
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            playerTwo: {
                _id: new Types.ObjectId(),
                firstName: 'Amy',
                lastName: 'Celuch',
                username: 'amy',
            },
            tags: ['good'],
        }
        await handleSubstitute(actionData, point._id.toString(), 'two', Point)

        const updatedPoint = await Point.findById(point._id)
        expect(updatedPoint?.teamTwoPlayers.length).toBe(1)
        expect(updatedPoint?.teamTwoPlayers[0].username).toBe(actionData.playerTwo?.username)
        expect(updatedPoint?.teamOnePlayers.length).toBe(0)
    })

    it('with unfound point error', async () => {
        const game = await Game.create(gameData)
        await Point.create(createPointData)
        game.teamOne = createPointData.pullingTeam
        await game.save()
        const actionData: ClientAction = {
            actionType: ActionType.SUBSTITUTION,
            playerOne: {
                _id: new Types.ObjectId(),
                firstName: 'Noah',
                lastName: 'Celuch',
                username: 'noah',
            },
            playerTwo: {
                _id: new Types.ObjectId(),
                firstName: 'Amy',
                lastName: 'Celuch',
                username: 'amy',
            },
            tags: ['good'],
        }
        await expect(handleSubstitute(actionData, new Types.ObjectId().toString(), 'one', Point)).rejects.toThrowError(
            new ApiError(Constants.UNABLE_TO_FIND_POINT, 404),
        )
    })
})
