const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const logger = require('../src/lib/logger');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id).then((user) => {
    done(null, user);
  });
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/api/auth/google/callback', // Must match Google Cloud Console config
    },
    async (accessToken, refreshToken, profile, done) => {
      // passport callback function
      try {
        // check if user already exists in our db
        const currentUser = await User.findOne({ googleId: profile.id });

        if (currentUser) {
          logger.debug({ userId: currentUser.id }, 'passport: existing Google user');
          return done(null, currentUser);
        } else {
          const newUser = await new User({
            googleId: profile.id,
            username: profile.displayName,
            email: profile.emails && profile.emails[0] ? profile.emails[0].value : null,
            avatarUrl: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
          }).save();
          logger.info({ userId: newUser.id }, 'passport: created new Google user');
          return done(null, newUser);
        }
      } catch (error) {
        return done(error, null);
      }
    }
  )
);
