const { EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');

let clientRef = null;

function setClient(client) {
  clientRef = client;
}

function parseUserAgent(ua) {
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('OPR') || ua.includes('Opera')) return 'Opera';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Discord')) return 'Discord App';
  return 'Desconhecido';
}

async function getGeoFromIP(ip) {
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,countryCode&lang=pt-BR`);
    const data = await res.json();
    if (data.status === 'success') {
      return {
        city: data.city || '?',
        region: data.regionName || '?',
        country: data.countryCode || '?',
      };
    }
  } catch {}
  return { city: '?', region: '?', country: '?' };
}

function getCountryFlag(code) {
  if (!code || code.length !== 2) return '🌐';
  const offset = 127397;
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => c.charCodeAt(0) + offset));
}

async function sendVerifyLog(userData, ip, userAgent) {
  if (!clientRef) return;
  const channelId = process.env.LOG_CHANNEL_ID;
  if (!channelId) return;

  try {
    const channel = await clientRef.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) return;

    const geo = await getGeoFromIP(ip);
    const flag = getCountryFlag(geo.country);
    const browser = parseUserAgent(userAgent);
    const now = new Date();
    const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

    // Days on Discord (from user ID snowflake)
    const discordEpoch = 1420070400000;
    const timestamp = Number(BigInt(userData.id) >> 22n) + discordEpoch;
    const daysOnDiscord = Math.floor((Date.now() - timestamp) / 86400000);

    const guild = clientRef.guilds.cache.get(process.env.GUILD_ID);
    const guildName = guild ? guild.name : 'Desconhecido';
    const guildId = process.env.GUILD_ID;
    const botUser = clientRef.user;

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setAuthor({ name: 'Usuário Verificado', iconURL: 'https://cdn.discordapp.com/emojis/1100000000000000000.png' })
      .setDescription('Detalhes da verificação do usuário abaixo.')
      .addFields(
        {
          name: 'Usuário',
          value: `<@${userData.id}>\n(\`${userData.username}\`)`,
          inline: true,
        },
        {
          name: 'Dias no Discord',
          value: `\`${daysOnDiscord}\``,
          inline: true,
        },
        {
          name: 'Endereço IP',
          value: `1. \`${ip}\``,
          inline: false,
        },
        {
          name: 'Localização',
          value: `1. ${flag} ${geo.city} — ${geo.region} — ${geo.country}`,
          inline: false,
        },
        {
          name: 'Dispositivo',
          value: `\`${browser}\``,
          inline: true,
        },
        {
          name: 'Autenticador',
          value: `<@${botUser.id}>\n(\`${botUser.id}\`)`,
          inline: true,
        },
        {
          name: 'Servidor',
          value: `\`${guildName} (${guildId})\``,
          inline: false,
        },
      )
      .setFooter({ text: `Verificação automatizada • Hoje às ${time}` })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Erro ao enviar log:', err.message);
  }
}

module.exports = { setClient, sendVerifyLog };
