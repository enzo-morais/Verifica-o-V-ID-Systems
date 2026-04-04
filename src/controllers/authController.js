const crypto = require('crypto');
const discordService = require('../services/discord');
const userService = require('../services/userService');
const { sendVerifyLog } = require('../services/logService');

// Simple in-memory state store (use Redis in production)
const states = new Map();

function authRedirect(req, res) {
  const state = crypto.randomBytes(16).toString('hex');
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'Desconhecido';
  states.set(state, { createdAt: Date.now(), ip, userAgent });
  // Clean old states (>10min)
  for (const [k, v] of states) {
    if (Date.now() - v.createdAt > 600000) states.delete(k);
  }
  res.redirect(discordService.getAuthURL(state));
}

async function callback(req, res) {
  const { code, state, error } = req.query;

  if (error || !code) {
    return res.redirect('/?status=error&msg=auth_denied');
  }

  if (!state || !states.has(state)) {
    return res.redirect('/?status=error&msg=invalid_state');
  }

  const stateData = states.get(state);
  states.delete(state);

  try {
    const tokens = await discordService.exchangeCode(code);
    const userData = await discordService.getUser(tokens.access_token);

    userService.saveUser(userData, tokens);

    const guildId = process.env.GUILD_ID;
    const roleId = process.env.ROLE_ID;

    try {
      await discordService.addToGuild(tokens.access_token, userData.id, guildId, roleId);
      userService.saveGuildJoin(userData.id, guildId);
    } catch (guildErr) {
      console.error('Guild/Role error (user still verified):', guildErr.message);
    }

    // Send log
    sendVerifyLog(userData, stateData.ip, stateData.userAgent).catch(console.error);

    res.redirect(`/?status=success&user=${encodeURIComponent(userData.username)}`);
  } catch (err) {
    console.error('Callback error:', err);
    res.redirect('/?status=error&msg=server_error');
  }
}

module.exports = { authRedirect, callback };
