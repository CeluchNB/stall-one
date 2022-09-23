import * as Constants from '../../../src/utils/constants'
import { getDisplayMessage, handleSubstitute, parseActionData, validateActionData } from '../../../src/utils/action'
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
                team: {
                    name: 'test name',
                },
                tags: ['good'],
            },
            2,
        )
        expect(action.tags[0]).toBe('good')
        expect(action.actionType).toBe(ActionType.PULL)
        expect(action.comments.length).toBe(0)
        expect(action.actionNumber).toBe(2)
    })
})

const action: ClientAction = {
    playerOne: {
        firstName: 'First 1',
        lastName: 'Last 1',
    },
    playerTwo: {
        firstName: 'First 2',
        lastName: 'Last 2',
    },
    team: {
        name: 'Team 1',
    },
    actionType: ActionType.PULL,
    tags: [],
}
const playerOne: Player = {
    firstName: 'First 1',
    lastName: 'Last 1',
}
const playerTwo: Player = {
    firstName: 'First 2',
    lastName: 'Last 2',
}
describe('test validate action data', () => {
    it('pull with player one and two', () => {
        expect(() => {
            action.actionType = ActionType.PULL
            action.playerOne = playerOne
            action.playerTwo = playerTwo
            validateActionData(action)
        }).toThrowError(new ApiError(Constants.INVALID_DATA, 400))
    })

    it('pull with player one and not player two', () => {
        action.actionType = ActionType.PULL
        action.playerOne = playerOne
        action.playerTwo = undefined
        expect(() => {
            validateActionData(action)
        }).not.toThrow()
    })

    it('pull with neither player', () => {
        action.actionType = ActionType.PULL
        action.playerOne = undefined
        action.playerTwo = undefined
        expect(() => {
            validateActionData(action)
        }).toThrowError(new ApiError(Constants.INVALID_DATA, 400))
    })

    it('throwaway with player one and two', () => {
        action.actionType = ActionType.THROWAWAY
        action.playerOne = playerOne
        action.playerTwo = playerTwo
        expect(() => {
            validateActionData(action)
        }).toThrowError(new ApiError(Constants.INVALID_DATA, 400))
    })

    it('throwaway with player one', () => {
        action.actionType = ActionType.THROWAWAY
        action.playerOne = playerOne
        action.playerTwo = undefined
        expect(() => {
            validateActionData(action)
        }).not.toThrow()
    })

    it('block with player one and two', () => {
        action.actionType = ActionType.BLOCK
        action.playerOne = playerOne
        action.playerTwo = playerTwo
        expect(() => {
            validateActionData(action)
        }).toThrowError(new ApiError(Constants.INVALID_DATA, 400))
    })

    it('block with player one', () => {
        action.actionType = ActionType.BLOCK
        action.playerOne = playerOne
        action.playerTwo = undefined
        expect(() => {
            validateActionData(action)
        }).not.toThrow()
    })

    it('pickup with player one and two', () => {
        action.actionType = ActionType.PICKUP
        action.playerOne = playerOne
        action.playerTwo = playerTwo
        expect(() => {
            validateActionData(action)
        }).toThrowError(new ApiError(Constants.INVALID_DATA, 400))
    })

    it('pickup with player one', () => {
        action.actionType = ActionType.PICKUP
        action.playerOne = playerOne
        action.playerTwo = undefined
        expect(() => {
            validateActionData(action)
        }).not.toThrow()
    })

    it('timeout with player one and two', () => {
        action.actionType = ActionType.TIMEOUT
        action.playerOne = playerOne
        action.playerTwo = playerTwo
        expect(() => {
            validateActionData(action)
        }).toThrowError(new ApiError(Constants.INVALID_DATA, 400))
    })

    it('timeout with player one', () => {
        action.actionType = ActionType.TIMEOUT
        action.playerOne = playerOne
        action.playerTwo = undefined
        expect(() => {
            validateActionData(action)
        }).not.toThrow()
    })

    it('call on field with player one and two', () => {
        action.actionType = ActionType.CALL_ON_FIELD
        action.playerOne = playerOne
        action.playerTwo = playerTwo
        expect(() => {
            validateActionData(action)
        }).toThrowError(new ApiError(Constants.INVALID_DATA, 400))
    })

    it('call on field with player one', () => {
        action.actionType = ActionType.CALL_ON_FIELD
        action.playerOne = playerOne
        action.playerTwo = undefined
        expect(() => {
            validateActionData(action)
        }).not.toThrow()
    })

    it('catch with player one and two', () => {
        action.actionType = ActionType.CATCH
        action.playerOne = playerOne
        action.playerTwo = playerTwo
        expect(() => {
            validateActionData(action)
        }).not.toThrow()
    })

    it('catch with player one or two', () => {
        action.actionType = ActionType.CATCH
        action.playerOne = playerOne
        action.playerTwo = undefined
        expect(() => {
            validateActionData(action)
        }).toThrowError(new ApiError(Constants.INVALID_DATA, 400))

        action.actionType = ActionType.CATCH
        action.playerOne = undefined
        action.playerTwo = playerTwo
        expect(() => {
            validateActionData(action)
        }).toThrowError(new ApiError(Constants.INVALID_DATA, 400))
    })

    it('drop with player one and two', () => {
        action.actionType = ActionType.DROP
        action.playerOne = playerOne
        action.playerTwo = playerTwo
        expect(() => {
            validateActionData(action)
        }).not.toThrow()
    })

    it('drop with player one or two', () => {
        action.actionType = ActionType.DROP
        action.playerOne = playerOne
        action.playerTwo = undefined
        expect(() => {
            validateActionData(action)
        }).toThrowError(new ApiError(Constants.INVALID_DATA, 400))

        action.actionType = ActionType.DROP
        action.playerOne = undefined
        action.playerTwo = playerTwo
        expect(() => {
            validateActionData(action)
        }).toThrowError(new ApiError(Constants.INVALID_DATA, 400))
    })

    it('score with player one and two', () => {
        action.actionType = ActionType.TEAM_ONE_SCORE
        action.playerOne = playerOne
        action.playerTwo = playerTwo
        expect(() => {
            validateActionData(action)
        }).not.toThrow()
    })

    it('score with player one or two', () => {
        action.actionType = ActionType.TEAM_ONE_SCORE
        action.playerOne = playerOne
        action.playerTwo = undefined
        expect(() => {
            validateActionData(action)
        }).toThrowError(new ApiError(Constants.INVALID_DATA, 400))

        action.actionType = ActionType.TEAM_ONE_SCORE
        action.playerOne = undefined
        action.playerTwo = playerTwo
        expect(() => {
            validateActionData(action)
        }).toThrowError(new ApiError(Constants.INVALID_DATA, 400))
    })

    it('substitution with player one and two', () => {
        action.actionType = ActionType.SUBSTITUTION
        action.playerOne = playerOne
        action.playerTwo = playerTwo
        expect(() => {
            validateActionData(action)
        }).not.toThrow()
    })

    it('substitution with player one or two', () => {
        action.actionType = ActionType.SUBSTITUTION
        action.playerOne = playerOne
        action.playerTwo = undefined
        expect(() => {
            validateActionData(action)
        }).toThrowError(new ApiError(Constants.INVALID_DATA, 400))

        action.actionType = ActionType.SUBSTITUTION
        action.playerOne = undefined
        action.playerTwo = playerTwo
        expect(() => {
            validateActionData(action)
        }).toThrowError(new ApiError(Constants.INVALID_DATA, 400))
    })

    it('finish game with no players', () => {
        action.actionType = ActionType.FINISH_GAME
        action.playerOne = undefined
        action.playerTwo = undefined
        expect(() => {
            validateActionData(action)
        }).not.toThrow()
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
            team: createPointData.pullingTeam,
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
        await handleSubstitute(actionData, game._id.toString(), point._id.toString(), Point, Game)

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
            team: createPointData.receivingTeam,
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
        await handleSubstitute(actionData, game._id.toString(), point._id.toString(), Point, Game)

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
            team: createPointData.receivingTeam,
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
        await expect(
            handleSubstitute(actionData, game._id.toString(), new Types.ObjectId().toString(), Point, Game),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FIND_POINT, 404))
    })

    it('with unfound game error', async () => {
        const game = await Game.create(gameData)
        const point = await Point.create({ ...createPointData, gameId: new Types.ObjectId() })
        game.teamOne = createPointData.pullingTeam
        await game.save()
        const actionData: ClientAction = {
            actionType: ActionType.SUBSTITUTION,
            team: createPointData.receivingTeam,
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

        await expect(
            handleSubstitute(actionData, new Types.ObjectId().toString(), point._id.toString(), Point, Game),
        ).rejects.toThrowError(new ApiError(Constants.UNABLE_TO_FIND_GAME, 404))
    })
})
