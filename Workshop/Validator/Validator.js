/**
 * Validator — inspects completed deliverables against Draftsman specifications.
 *
 * validate()  checks structure and required fields/components.
 * approve()   calls validate() internally — rejects if validation fails.
 * reject()    records issues for return to the Fabricator.
 * report()    produces a full validation summary.
 */
'use strict';

// ── Guard helpers ─────────────────────────────────────────────────────────────

function assertDeliverable(deliverable) {
  if (!deliverable || typeof deliverable !== 'object')
    throw new Error('Validator requires a valid deliverable object.');
  if (!deliverable.id)
    throw new Error('Deliverable must include an id.');
}

function assertSpecification(specification) {
  if (!specification || typeof specification !== 'object')
    throw new Error('Validator requires a valid specification object.');
  if (!specification.id)
    throw new Error('Specification must include an id.');
}

// ── validate ──────────────────────────────────────────────────────────────────

function validate(deliverable, specification) {
  assertDeliverable(deliverable);
  assertSpecification(specification);

  const issues = [];

  // Source must match specification id when present.
  if (deliverable.metadata?.source && deliverable.metadata.source !== specification.id) {
    issues.push('Deliverable source does not match specification id.');
  }

  // Required fields — search the compiled product and its stat/profile buckets.
  if (Array.isArray(specification.requiredFields)) {
    const product = deliverable.payload?.product || {};
    const flat = {
      ...product,
      ...(product.stats   || {}),
      ...(product.profile || {}),
    };
    const missing = specification.requiredFields.filter(field => !(field in flat));
    if (missing.length)
      issues.push(`Missing required fields: ${missing.join(', ')}`);
  }

  // Required components — checked against deliverable.outputs (what the Fabricator renders).
  if (Array.isArray(specification.requiredComponents)) {
    const outputs = deliverable.outputs || {};
    const missing = specification.requiredComponents.filter(c => !(c in outputs));
    if (missing.length)
      issues.push(`Missing required components: ${missing.join(', ')}`);
  }

  return { valid: issues.length === 0, issues };
}

// ── approve ───────────────────────────────────────────────────────────────────
// Runs validation before approving. If a specification is not provided the
// structural guards still run; field/component checks are skipped.

function approve(deliverable, specification) {
  assertDeliverable(deliverable);

  if (specification) {
    const result = validate(deliverable, specification);
    if (!result.valid) {
      return {
        status:     'rejected',
        id:         deliverable.id,
        rejectedAt: new Date().toISOString(),
        issues:     result.issues,
      };
    }
  }

  return {
    status:     'approved',
    id:         deliverable.id,
    approvedAt: new Date().toISOString(),
  };
}

// ── reject ────────────────────────────────────────────────────────────────────

function reject(deliverable, issues = []) {
  assertDeliverable(deliverable);
  return {
    status:     'rejected',
    id:         deliverable.id,
    rejectedAt: new Date().toISOString(),
    issues:     Array.isArray(issues) ? issues : [String(issues)],
  };
}

// ── report ────────────────────────────────────────────────────────────────────

function report(result, deliverable, specification) {
  return {
    deliverableId:   deliverable?.id    || null,
    specificationId: specification?.id  || null,
    status:          result.valid ? 'approved' : 'rejected',
    issues:          result.issues || [],
    evaluatedAt:     new Date().toISOString(),
  };
}

// ── Factory ───────────────────────────────────────────────────────────────────

module.exports = function createValidator() {
  return { validate, approve, reject, report };
};
