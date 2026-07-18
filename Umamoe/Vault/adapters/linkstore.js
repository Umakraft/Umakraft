/**
 * Link store — persists Discord user ↔ trainer ID associations.
 * Stored as a simple JSON file so links survive restarts.
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const LINKS_FILE = path.join(process.cwd(), 'data', 'links.json');

function ensureDir() {
  const dir = path.dirname(LINKS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function load() {
  ensureDir();
  try {
    if (!fs.existsSync(LINKS_FILE)) return {};
    return JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function save(data) {
  ensureDir();
  const tmp = LINKS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, LINKS_FILE);
}

/**
 * Link a Discord user to a trainer.
 * @param {string} discordId
 * @param {string} trainerId
 * @param {string} [discordName]
 */
function setLink(discordId, trainerId, discordName) {
  const links = load();
  links[discordId] = {
    trainerId,
    discordName: discordName || discordId,
    linkedAt: new Date().toISOString(),
  };
  save(links);
  return links[discordId];
}

/**
 * Retrieve the link record for a Discord user, or null if not linked.
 * @param {string} discordId
 */
function getLink(discordId) {
  const links = load();
  return links[discordId] || null;
}

/**
 * Remove the link for a Discord user.
 * @param {string} discordId
 */
function removeLink(discordId) {
  const links = load();
  const existed = discordId in links;
  delete links[discordId];
  save(links);
  return { removed: existed };
}

/**
 * Return all links as an array of { discordId, trainerId, linkedAt } records.
 */
function getAllLinks() {
  const links = load();
  return Object.entries(links).map(([discordId, v]) => ({ discordId, ...v }));
}

module.exports = { setLink, getLink, removeLink, getAllLinks };
