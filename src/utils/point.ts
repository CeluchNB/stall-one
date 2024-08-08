import IGame, { GameStatus } from '../types/game'
import IPoint, { PointStatus } from '../types/point'

export const pointIsComplete = (point: IPoint, game: IGame): boolean => {
    if (point.teamOneStatus !== PointStatus.COMPLETE) return false
    if (point.teamTwoStatus === PointStatus.COMPLETE) return true
    return game.teamTwoStatus !== GameStatus.ACTIVE
}

export const pointIsActive = (point: IPoint): boolean => {
    return point.teamOneStatus === PointStatus.ACTIVE || point.teamTwoStatus === PointStatus.ACTIVE
}
