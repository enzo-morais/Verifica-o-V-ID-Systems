const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MediaGalleryBuilder, MediaGalleryItemBuilder, ContainerBuilder, MessageFlags } = require('discord.js');
const { addUserToGuild } = require('../services/multiGuild');
const { getUser, getAllUsers } = require('../services/userService');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

function buildVerifyComponents() {
  const siteURL = process.env.REDIRECT_URI.replace('/callback', '');
  return [
    new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("## <:void:1461814125087953168> Verificação - VØID Systems  "),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("Bem-vindo à **VØID Systems**, a sua central de tecnologia e automação avançada para Discord!\n\nPara acessar nossos sistemas exclusivos e gerenciar seus bots com total segurança, é necessário realizar a autenticação."),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("## • Por que autenticar?\n\n**Segurança Avançada:** Garante uma experiência personalizada e protege seus dados dentro da nossa infraestrutura.\n"),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("\n## • Segurança e Privacidade\n\nA **VØID Systems** preza pela transparência. Seus dados são processados de forma criptografada e nunca serão compartilhados."),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("  • *Clique em **\"Verifique-se\"** para prosseguir e explorar o ecossistema VØID.*"),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
      )
      .addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder().setURL("https://cdn.discordapp.com/attachments/1456775983091814451/1465858030544617564/barrinha_void_roupas.gif?ex=69d24dec&is=69d0fc6c&hm=8fe71a5fd45b3ea9a06a85d47d859b95e30a3eb7a76a3f1319019f460d7ddaca&"),
        ),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true),
      )
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel("Verifique-se")
            .setEmoji("<:void:1461814125087953168>")
            .setURL(`${siteURL}/auth/discord`),
        ),
      ),
  ];
}

async function sendVerifyMessage() {
  const channelId = process.env.VERIFY_CHANNEL_ID;
  if (!channelId) return;
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) return;
    const messages = await channel.messages.fetch({ limit: 50 });
    const existing = messages.find(m => m.author.id === client.user.id && m.components.length > 0);
    if (existing) {
      console.log('Mensagem de verificação já existe. Pulando.');
      return;
    }
    const components = buildVerifyComponents();
    await channel.send({ components, flags: MessageFlags.IsComponentsV2 });
    console.log('Mensagem de verificação enviada!');
  } catch (err) {
    console.error('Erro ao enviar verificação:', err.message);
  }
}

const commands = [
  new SlashCommandBuilder()
    .setName('puxar')
    .setDescription('Puxar um usuário verificado para este servidor')
    .addUserOption(o => o.setName('usuario').setDescription('Usuário para puxar').setRequired(true))
    .addRoleOption(o => o.setName('cargo').setDescription('Cargo para dar').setRequired(true))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('puxartodos')
    .setDescription('Puxar TODOS os verificados para este servidor')
    .addRoleOption(o => o.setName('cargo').setDescription('Cargo para dar a todos').setRequired(true))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('verificados')
    .setDescription('Listar todos os usuários verificados no banco')
    .toJSON(),
];

async function registerCommandsAllGuilds() {
  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
  const guilds = client.guilds.cache;
  console.log(`Registrando comandos em ${guilds.size} servidor(es)...`);
  for (const [id, guild] of guilds) {
    try {
      await rest.put(Routes.applicationGuildCommands(client.user.id, id), { body: commands });
      console.log(`  ✓ ${guild.name}`);
    } catch (err) {
      console.error(`  ✗ ${guild.name}: ${err.message}`);
    }
  }
}

client.on('guildCreate', async (guild) => {
  // Register commands instantly when bot joins a new server
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: commands });
    console.log(`Comandos registrados no novo servidor: ${guild.name}`);
  } catch (err) {
    console.error(`Erro ao registrar em ${guild.name}:`, err.message);
  }
});

client.once('clientReady', async () => {
  console.log(`Bot online: ${client.user.tag}`);
  await registerCommandsAllGuilds();
  await sendVerifyMessage();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // /puxar <usuario> <cargo>
  if (interaction.commandName === 'puxar') {
    if (!interaction.memberPermissions.has('Administrator')) {
      return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });
    }

    const target = interaction.options.getUser('usuario');
    const role = interaction.options.getRole('cargo');
    const guildId = interaction.guildId;

    await interaction.deferReply({ ephemeral: true });

    const dbUser = getUser(target.id);
    if (!dbUser) {
      return interaction.editReply('❌ Esse usuário não está verificado no sistema.');
    }

    try {
      await addUserToGuild(target.id, guildId, role.id);
      await interaction.editReply(`✅ **${dbUser.username}** foi puxado pro servidor com o cargo **${role.name}**.`);
    } catch (err) {
      console.error('Erro ao puxar:', err.message);
      await interaction.editReply(`❌ Erro: ${err.message}`);
    }
  }

  // /puxartodos <cargo>
  if (interaction.commandName === 'puxartodos') {
    if (!interaction.memberPermissions.has('Administrator')) {
      return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });
    }

    const role = interaction.options.getRole('cargo');
    const guildId = interaction.guildId;

    await interaction.deferReply({ ephemeral: true });

    const users = getAllUsers();
    if (!users.length) {
      return interaction.editReply('❌ Nenhum usuário verificado no banco.');
    }

    let success = 0;
    let failed = 0;

    for (const user of users) {
      try {
        await addUserToGuild(user.user_id, guildId, role.id);
        success++;
      } catch {
        failed++;
      }
      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 1000));
    }

    await interaction.editReply(`✅ Concluído: **${success}** puxados, **${failed}** falharam. Total: **${users.length}**`);
  }

  // /verificados
  if (interaction.commandName === 'verificados') {
    if (!interaction.memberPermissions.has('Administrator')) {
      return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });
    }

    const users = getAllUsers();
    if (!users.length) {
      return interaction.reply({ content: 'Nenhum usuário verificado.', ephemeral: true });
    }

    const list = users.slice(0, 20).map((u, i) =>
      `\`${i + 1}.\` **${u.username}** — \`${u.user_id}\``
    ).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle(`Usuários Verificados (${users.length})`)
      .setDescription(list + (users.length > 20 ? `\n\n... e mais ${users.length - 20}` : ''));

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

function startBot() {
  return client.login(process.env.BOT_TOKEN);
}

module.exports = { client, startBot };
