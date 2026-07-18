'use strict';

const fs   = require('fs');
const path = require('path');

// Files in this directory that are NOT slash-command modules.
// Explicitly excluded to avoid loading utility/registration helpers as commands.
const NON_COMMAND_FILES = new Set([
  'index.js',
  'circle-utils.js',
  'register-commands.js',
]);

function loadCommands() {
  const commandsDir = __dirname;
  const files = fs
    .readdirSync(commandsDir)
    .filter(f => f.endsWith('.js') && !NON_COMMAND_FILES.has(f));

  const commands = new Map();
  for (const file of files) {
    const command = require(path.join(commandsDir, file));
    if (command && command.data && command.data.name) {
      commands.set(command.data.name, command);
    }
  }

  return commands;
}

function getCommandData() {
  return Array.from(loadCommands().values()).map(c => c.data);
}

module.exports = { loadCommands, getCommandData };
