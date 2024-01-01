import passport from 'passport'
import passportJwt, { StrategyOptions } from 'passport-jwt'

const JwtStrategy = passportJwt.Strategy

const ExtractJwt = passportJwt.ExtractJwt

export const loadPassportMiddleware = () => {
    const opts: StrategyOptions = {
        secretOrKey: process.env.JWT_SECRET,
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    }

    passport.use(
        new JwtStrategy(opts, async (jwtPayload, done) => {
            return done(null, { gameId: jwtPayload.sub, team: jwtPayload.team })
        }),
    )
}
