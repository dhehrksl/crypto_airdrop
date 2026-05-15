require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Expo } = require('expo-server-sdk');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Airdrop = require('./models/Airdrop');
const News = require('./models/News');
const User = require('./models/User');
const { runScraper } = require('./src/services/scraper');

const app = express();
const expo = new Expo();

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-that-is-long';

app.use(cors());
app.use(express.json());

// Passport middleware
const passport = require('passport');
require('./config/passport-setup'); // This configures the strategy
app.use(passport.initialize());


// --- Other API Routes ---

app.post('/api/users/push-token', async (req, res) => {
  try {
    const { token, userId } = req.body;
    if (!token || !userId) return res.status(400).json({ error: 'Token and userId are required' });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.push_token = token;
    await user.save();
    res.json({ message: 'Push token registered successfully' });
  } catch (error) {
    console.error('Push token registration error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/notifications/test', async (req, res) => {
  try {
    const users = await User.find({ push_token: { $exists: true, $ne: null } });
    const pushTokens = users.map(user => user.push_token);
    if (pushTokens.length === 0) return res.status(404).json({ message: 'No registered push tokens found.' });
    const messages = [];
    for (const pushToken of pushTokens) {
      if (!Expo.isExpoPushToken(pushToken)) continue;
      messages.push({
        to: pushToken,
        sound: 'default',
        title: '🔔 테스트 알림',
        body: '축하합니다! 푸시 알림 기능이 성공적으로 연동되었습니다.',
        data: { screen: 'Home' },
      });
    }
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }
    res.json({ message: 'Test push notifications sent!', tickets });
  } catch (error) {
    console.error('Error sending test push notifications:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/scraper/run', async (req, res) => {
  try {
    await runScraper();
    res.json({ message: 'Scraper execution started' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- API Routes ---
app.use('/api/airdrops', require('./routes/airdrops'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/guaranteed-airdrops', require('./routes/guaranteedAirdrops'));
app.use('/api/user', require('./routes/user'));
app.use('/api/market', require('./routes/market'));


const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto_airdrop';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB connection error:', err));



app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
