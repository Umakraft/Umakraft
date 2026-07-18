'use strict';

const fs   = require('fs').promises;
const path = require('path');

// blueprints.js lives at Workshop/Draftsman/Blueprint/blueprints.js
// __dirname is Workshop/Draftsman/Blueprint — that IS the blueprint directory.
const blueprintDir   = __dirname;
const commandMapPath = path.join(__dirname, 'command-blueprints.json');

async function listBlueprintFiles() {
  const files = await fs.readdir(blueprintDir);
  return files.filter(f => f.endsWith('.md'));
}

async function getBlueprint(name) {
  const filename = name.endsWith('.md') ? name : `${name}.md`;
  const filePath = path.join(blueprintDir, filename);
  return fs.readFile(filePath, 'utf8');
}

async function saveBlueprint(name, content) {
  const filename = name.endsWith('.md') ? name : `${name}.md`;
  const filePath = path.join(blueprintDir, filename);
  await fs.writeFile(filePath, content, 'utf8');
  return filename;
}

async function deleteBlueprint(name) {
  const filename = name.endsWith('.md') ? name : `${name}.md`;
  const filePath = path.join(blueprintDir, filename);
  await fs.unlink(filePath);
  return filename;
}

async function loadCommandBlueprintMap() {
  const raw = await fs.readFile(commandMapPath, 'utf8');
  return JSON.parse(raw);
}

async function getBlueprintForCommand(commandName) {
  const normalized = commandName.replace(/^\//, '').toLowerCase();
  const map = await loadCommandBlueprintMap();
  const blueprintName = map[normalized];
  if (!blueprintName) throw new Error(`No blueprint mapped for command: ${commandName}`);
  return getBlueprint(blueprintName);
}

async function getBlueprintPathForCommand(commandName) {
  const normalized = commandName.replace(/^\//, '').toLowerCase();
  const map = await loadCommandBlueprintMap();
  const blueprintName = map[normalized];
  if (!blueprintName) throw new Error(`No blueprint mapped for command: ${commandName}`);
  return path.join(blueprintDir, `${blueprintName}.md`);
}

module.exports = {
  listBlueprintFiles,
  getBlueprint,
  getBlueprintForCommand,
  getBlueprintPathForCommand,
  saveBlueprint,
  deleteBlueprint,
};
