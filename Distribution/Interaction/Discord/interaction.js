'use strict';

const { loadCommands } = require('./commands');

function createDiscordInteraction({ services, logger }) {
  const commands = loadCommands();

  async function handleInteraction(interaction) {
    const commandName = interaction.commandName;
    const command = commands.get(commandName);

    // ── Autocomplete ────────────────────────────────────────────────────────
    if (interaction.isAutocomplete?.()) {
      if (command?.autocomplete) {
        try {
          return await command.autocomplete({ interaction, services, logger });
        } catch (error) {
          logger?.warn?.('Discord autocomplete error', { command: commandName, error });
          return interaction.respond?.([]);
        }
      }
      return;
    }

    if (!interaction.isCommand?.()) return;

    // ── Unknown command ─────────────────────────────────────────────────────
    if (!command) {
      return interaction.reply({
        content: `Unknown command: ${commandName}`,
        ephemeral: true,
      });
    }

    // ── Execute ─────────────────────────────────────────────────────────────
    try {
      const response = await command.execute({ interaction, services, logger });

      // Commands may either:
      //   (a) call interaction.editReply() / interaction.reply() directly and
      //       return void/null — nothing more to do.
      //   (b) return a response object (embeds, content, etc.) for us to send.
      //
      // Previously only option (b) with a .content key was handled, which silently
      // dropped every embed-only response. Now we send any truthy object returned.
      if (response && typeof response === 'object') {
        return interaction.editReply(response);
      }

    } catch (error) {
      logger?.error?.('Discord command error', { command: commandName, error });
      try {
        return interaction.editReply({
          content: 'An error occurred while processing your command.',
        });
      } catch {
        // editReply can fail if the interaction was never deferred; ignore.
      }
    }
  }

  return {
    handleInteraction,
    getRegisteredCommands: () => Array.from(commands.values()).map((c) => c.data),
  };
}

module.exports = createDiscordInteraction;
