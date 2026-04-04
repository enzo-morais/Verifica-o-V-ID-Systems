require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');
const authRoutes = require('./routes/auth');
const { startBot } = require('./bot/bot');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (Railway, Render, etc.)
app.set('trust proxy', 1);

// Static frontend FIRST (no rate limit)
app.use(express.static(path.join(__dirname, '../public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Rate limit only on auth routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many requests, try again later.',
});

app.use('/auth', limiter);
app.use('/callback', limiter);

// Routes
app.use(authRoutes);

// Start server + bot
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  try {
    await startBot();
  } catch (err) {
    console.error('Failed to start bot:', err.message);
  }
});
