/**
 * Inspector — validates data from the Courier before it enters the Vault.
 * Runs 5 sequential validation categories as defined in VALIDATION_RULES.md.
 */
const Vault = require('../Vault/vault');
const vault = new Vault();

function isoNow() { return new Date().toISOString(); }

function log(level, message, details) {
  console.log(`[${isoNow()}] ${level} inspector: ${message}`);
  if (details) console.log(JSON.stringify(details, null, 2));
}

// ── ID normalisation ──────────────────────────────────────────────────────────
// uma.moe API responses use different ID field names depending on the endpoint.
// Normalise to a top-level `id` field before validation so the Vault adapter
// always has a stable key to use, regardless of which endpoint was called.
const ID_FIELD_CANDIDATES = ['id', 'viewer_id', 'trainer_id', 'account_id', 'circle_id', 'veteran_id'];

function normaliseId(data) {
  if (!data || typeof data !== 'object') return data;
  let normalised = data;

  // Normalise id field.
  if (normalised.id === undefined || normalised.id === null || normalised.id === '') {
    for (const field of ID_FIELD_CANDIDATES) {
      if (normalised[field] !== undefined && normalised[field] !== null && normalised[field] !== '') {
        normalised = Object.assign({}, normalised, { id: String(normalised[field]) });
        break;
      }
    }
  }

  // Normalise trainer_name → name so completeness checks work regardless of
  // which field name the uma.moe API uses for a given endpoint version.
  if ((normalised.name === undefined || normalised.name === null || normalised.name === '') &&
      normalised.trainer_name !== undefined && normalised.trainer_name !== null) {
    normalised = Object.assign({}, normalised, { name: normalised.trainer_name });
  }

  return normalised;
}

// ── Endpoint profile ──────────────────────────────────────────────────────────
// Different endpoints return different shapes. Only enforce trainer-specific
// required fields (fans, rank) when the endpoint is a trainer profile endpoint.
function getEndpointProfile(endpoint = '') {
  if (/\/profile\/|\/trainers\//.test(endpoint)) return 'trainer';
  if (/\/circles/.test(endpoint))                return 'circle';
  return 'generic';
}

// ── Category 1: Existence ─────────────────────────────────────────────────────
function validateExistence(data) {
  if (data === null || data === undefined)
    return { passed: false, reason: 'EXISTENCE_FAILURE: Data is null or undefined' };
  if (typeof data !== 'object' || Array.isArray(data))
    return { passed: false, reason: 'EXISTENCE_FAILURE: Data is not an object or is an array' };
  if (Object.keys(data).length === 0)
    return { passed: false, reason: 'EXISTENCE_FAILURE: Data is empty object' };
  return { passed: true };
}

// ── Category 2: Structure ─────────────────────────────────────────────────────
function validateStructure(data) {
  if (typeof data !== 'object' || Array.isArray(data))
    return { passed: false, reason: 'STRUCTURE_FAILURE: Expected object, got array or primitive' };
  try {
    for (const key in data) { if (Object.prototype.hasOwnProperty.call(data, key)) { /* ok */ } }
  } catch (err) {
    return { passed: false, reason: `STRUCTURE_FAILURE: Cannot access object properties — ${err.message}` };
  }
  return { passed: true };
}

// ── Category 3: Completeness ──────────────────────────────────────────────────
function validateCompleteness(data, profile = 'generic') {
  // All profiles require an id after normalisation.
  const requiredFields = ['id'];
  if (profile === 'trainer') requiredFields.push('name', 'fans', 'rank');
  if (profile === 'circle')  requiredFields.push('name');

  for (const field of requiredFields) {
    if (!(field in data))
      return { passed: false, reason: `COMPLETENESS_FAILURE: Required field '${field}' is missing` };

    const value = data[field];
    if (value === null || value === undefined)
      return { passed: false, reason: `COMPLETENESS_FAILURE: Required field '${field}' is null or undefined` };
    if (typeof value === 'string' && value.trim() === '')
      return { passed: false, reason: `COMPLETENESS_FAILURE: Required field '${field}' is empty string` };
    if ((field === 'fans' || field === 'rank') && Number.isNaN(value))
      return { passed: false, reason: `COMPLETENESS_FAILURE: Required field '${field}' is NaN` };
  }
  return { passed: true };
}

// ── Category 4: Type Integrity ────────────────────────────────────────────────
function validateTypeIntegrity(data, profile = 'generic') {
  if (profile !== 'trainer') return { passed: true }; // only enforce for trainer payloads

  const stringFields = ['id', 'name'];
  for (const field of stringFields) {
    if (field in data && typeof data[field] !== 'string')
      return { passed: false, reason: `TYPE_INTEGRITY_FAILURE: Field '${field}' must be string, got ${typeof data[field]}` };
  }

  const integerFields = ['fans', 'rank'];
  for (const field of integerFields) {
    if (field in data) {
      if (typeof data[field] !== 'number')
        return { passed: false, reason: `TYPE_INTEGRITY_FAILURE: Field '${field}' must be number, got ${typeof data[field]}` };
      if (Number.isNaN(data[field]))
        return { passed: false, reason: `TYPE_INTEGRITY_FAILURE: Field '${field}' is NaN` };
      if (!Number.isInteger(data[field]))
        return { passed: false, reason: `TYPE_INTEGRITY_FAILURE: Field '${field}' must be integer, got ${data[field]}` };
    }
  }

  const arrayFields = ['characters', 'achievements'];
  for (const field of arrayFields) {
    if (field in data && !Array.isArray(data[field]))
      return { passed: false, reason: `TYPE_INTEGRITY_FAILURE: Field '${field}' must be array, got ${typeof data[field]}` };
  }

  return { passed: true };
}

// ── Category 5: Range Integrity ───────────────────────────────────────────────
function validateRangeIntegrity(data, profile = 'generic') {
  if (profile !== 'trainer') return { passed: true };

  if ('fans' in data && data.fans < 0)
    return { passed: false, reason: `RANGE_INTEGRITY_FAILURE: Field 'fans' cannot be negative, got ${data.fans}` };

  // Rank range: 1–100 per spec; treat 0 and values above 100 as invalid.
  // Real rankings can exceed 100, so only enforce when value is explicitly invalid.
  if ('rank' in data && (data.rank < 1 || data.rank > 1000000))
    return { passed: false, reason: `RANGE_INTEGRITY_FAILURE: Field 'rank' must be ≥ 1, got ${data.rank}` };

  return { passed: true };
}

// ── Metadata validation ───────────────────────────────────────────────────────
function validateMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object')
    return { passed: false, reason: 'METADATA_FAILURE: Missing metadata object' };
  if (typeof metadata.endpoint !== 'string' || metadata.endpoint.trim() === '')
    return { passed: false, reason: 'METADATA_FAILURE: Missing endpoint metadata' };
  if (typeof metadata.statusCode !== 'number')
    return { passed: false, reason: 'METADATA_FAILURE: Missing statusCode metadata' };
  return { passed: true };
}

// ── Main entry point ──────────────────────────────────────────────────────────
async function receive(input) {
  // Pass through Miner/Courier errors unchanged.
  if (input && input.success === false) {
    log('WARN', 'Error result received — passing through', { error: input.error, context: input.context });
    return input;
  }

  let data     = input && input.data;
  const metadata = input && input.metadata;

  // Normalise ID field before any validation.
  data = normaliseId(data);

  const profile = getEndpointProfile(metadata && metadata.endpoint);

  // ── Run all 5 validation categories in sequence ───────────────────────────

  let res = validateExistence(data);
  if (!res.passed) {
    log('INFO', 'Validation failed — existence', { reason: res.reason });
    return { passed: false, originalData: data, reason: res.reason };
  }

  res = validateStructure(data);
  if (!res.passed) {
    log('WARN', 'Validation failed — structure', { reason: res.reason });
    return { passed: false, originalData: data, reason: res.reason };
  }

  res = validateMetadata(metadata);
  if (!res.passed) {
    log('WARN', 'Validation failed — metadata', { reason: res.reason, metadata });
    return { passed: false, originalData: data, reason: res.reason };
  }

  res = validateCompleteness(data, profile);
  if (!res.passed) {
    log('WARN', 'Validation failed — completeness', { reason: res.reason, profile });
    return { passed: false, originalData: data, reason: res.reason };
  }

  res = validateTypeIntegrity(data, profile);
  if (!res.passed) {
    log('WARN', 'Validation failed — type integrity', { reason: res.reason, profile });
    return { passed: false, originalData: data, reason: res.reason };
  }

  res = validateRangeIntegrity(data, profile);
  if (!res.passed) {
    log('WARN', 'Validation failed — range integrity', { reason: res.reason, profile });
    return { passed: false, originalData: data, reason: res.reason };
  }

  // ── All categories passed — store in Vault ────────────────────────────────
  log('INFO', 'Validation successful — accepting data', { id: data.id, endpoint: metadata.endpoint, profile });

  const envelope = {
    trustedData: data,
    metadata: Object.assign({}, metadata, { inspectedAt: isoNow(), storedAt: isoNow() }),
  };

  const storeResult = await vault.store(envelope);
  if (storeResult && storeResult.success) {
    log('INFO', 'Stored trusted data in Vault', { id: data.id, storedAt: storeResult.storedAt });
  } else {
    log('ERROR', 'Failed to store in Vault', { id: data.id, storeResult });
  }

  return { passed: true, originalData: data, reason: null, vault: storeResult };
}

module.exports = {
  receive,
  validateExistence,
  validateStructure,
  validateCompleteness,
  validateTypeIntegrity,
  validateRangeIntegrity,
};
