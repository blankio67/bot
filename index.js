// index.js
const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  REST, 
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// ==== CONFIG ====
const TOKEN = "YOUR_BOT_TOKEN";
const CLIENT_ID = "YOUR_CLIENT_ID";
const GUILD_ID = "YOUR_GUILD_ID";
const LOG_CHANNEL_ID = "1414453183773802576"; // Ticket logs

// ==== REGISTER SLASH COMMAND ====
const commands = [
  {
    name: "ticket",
    description: "Ticket commands",
    options: [
      {
        name: "setup",
        description: "Setup the ticket panel",
        type: 1,
        options: [
          {
            name: "name",
            description: "Panel name",
            type: 3,
            required: true
          }
        ]
      }
    ]
  }
];

const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("✅ Slash commands registered.");
  } catch (err) {
    console.error(err);
  }
})();

// ==== BOT EVENTS ====
client.on("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ==== SLASH COMMAND HANDLER ====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ticket" && interaction.options.getSubcommand() === "setup") {
    const name = interaction.options.getString("name");

    const embed = new EmbedBuilder()
      .setTitle(`${interaction.guild.name}`)
      .setDescription(`Welcome to the Ticket Support System!\nClick the button below to open a ticket!`)
      .setColor("Blue");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("open_ticket")
        .setLabel("Support")
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({ 
      content: `**${name}**\nWelcome to ticket setup V2`, 
      embeds: [embed], 
      components: [row] 
    });
  }
});

// ==== BUTTON HANDLER ====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  // OPEN TICKET
  if (interaction.customId === "open_ticket") {
    // Modal for ticket questions
    const modal = new ModalBuilder()
      .setCustomId("ticket_form")
      .setTitle("Tickets RegaurdV1");

    const q1 = new TextInputBuilder()
      .setCustomId("username")
      .setLabel("In Game Username")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const q2 = new TextInputBuilder()
      .setCustomId("problem")
      .setLabel("Problem you're having?")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const q3 = new TextInputBuilder()
      .setCustomId("discord_problem")
      .setLabel("Is this a Discord problem? (Yes/No)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const q4 = new TextInputBuilder()
      .setCustomId("rules")
      .setLabel("Have you read the rules? (Yes/No)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(q1),
      new ActionRowBuilder().addComponents(q2),
      new ActionRowBuilder().addComponents(q3),
      new ActionRowBuilder().addComponents(q4)
    );

    await interaction.showModal(modal);
  }

  // SEND RESPONSE
  if (interaction.customId.startsWith("send_response_")) {
    const userId = interaction.customId.split("_")[2];

    const modal = new ModalBuilder()
      .setCustomId(`response_modal_${userId}`)
      .setTitle("Send Response");

    const input = new TextInputBuilder()
      .setCustomId("response_message")
      .setLabel("Response to user")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
  }

  // CLOSE TICKET
  if (interaction.customId.startsWith("close_ticket_")) {
    await interaction.reply({ content: "Ticket closed ✅", ephemeral: true });
    const channel = interaction.channel;
    setTimeout(() => channel.delete().catch(() => {}), 3000);
  }
});

// ==== MODAL SUBMISSION HANDLER ====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isModalSubmit()) return;

  // Ticket form
  if (interaction.customId === "ticket_form") {
    const username = interaction.fields.getTextInputValue("username");
    const problem = interaction.fields.getTextInputValue("problem");
    const discordProblem = interaction.fields.getTextInputValue("discord_problem");
    const rules = interaction.fields.getTextInputValue("rules");

    const ticketChannel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: interaction.guild.roles.everyone.id,
          deny: ["ViewChannel"]
        },
        {
          id: interaction.user.id,
          allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"]
        }
      ]
    });

    const embed = new EmbedBuilder()
      .setTitle("**New Ticket**")
      .setDescription(`**User:** <@${interaction.user.id}>\n**Minecraft Username**: ${username}\n**Problem**: ${problem}\n**Is this a Discord Problem**: ${discordProblem}\n**Have you read rules?**: ${rules}`)
      .setColor("Green");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`send_response_${interaction.user.id}`)
        .setLabel("Send Response")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`close_ticket_${interaction.user.id}`)
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger)
    );

    await ticketChannel.send({ embeds: [embed], components: [row] });

    // Send DM to user
    try {
      await interaction.user.send(
        "Hey! Our staff will respond to your ticket within the hour, if not then in 2 - 4 hours!"
      );
    } catch {}

    // Send log
    const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL_ID);
    if (logChannel) {
      await logChannel.send({ content: `📩 Ticket created by <@${interaction.user.id}> in ${ticketChannel}` });
    }

    await interaction.reply({ content: `✅ Ticket created: ${ticketChannel}`, ephemeral: true });
  }

  // Response modal
  if (interaction.customId.startsWith("response_modal_")) {
    const userId = interaction.customId.split("_")[2];
    const responseMsg = interaction.fields.getTextInputValue("response_message");

    try {
      const user = await client.users.fetch(userId);
      await user.send(`📩 Staff Response:\n${responseMsg}`);
    } catch {}

    await interaction.reply({ content: "✅ Response sent to user via DM", ephemeral: true });
  }
});

client.login(TOKEN);
