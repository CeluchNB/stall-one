import * as Constants from '../utils/constants'
import passport from 'passport'
import passportJwt, { StrategyOptions } from 'passport-jwt'
import Game from '../models/game'

const JwtStrategy = passportJwt.Strategy

const ExtractJwt = passportJwt.ExtractJwt
const opts: StrategyOptions = {
    secretOrKey: process.env.JWT_SECRET,
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
}

passport.use(
    new JwtStrategy(opts, async (jwtPayload, done) => {
        const game = await Game.findById(jwtPayload.sub)
        if (!game) {
            return done(null, false, { message: Constants.UNABLE_TO_FETCH_TEAM })
        }

        return done(null, game)
    }),
)
