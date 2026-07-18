const fs = require('fs');
const path = require('path');

function loadCommands() {
  const commandsDir = __dirname;
  const files = fs.readdirSync(commandsDir).filter((file) => file.endsWith('.js') && file !== 'index.js');

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
  return Array.from(loadCommands().values()).map((command) => command.data);
}

module.exports = {
  loadCommands,
  getCommandData,
};
