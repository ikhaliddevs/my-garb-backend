const { object, measurements, discovery } = require('./profile');
const { HttpError } = require('../middleware/errors');
function invalid() { throw new HttpError(400, 'INVALID_INPUT', 'Invalid conversation or agreement input'); }
function text(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2000 || [...value].some(c => (c.codePointAt(0) < 32 && !['\n', '\t'].includes(c)) || c.codePointAt(0) === 127)) invalid();
  return value.trim();
}
function message(body) { object(body, ['text']); return text(body.text); }
function pagination(query) { object(query, ['page', 'limit']); return discovery(query); }
function version(value) { if (!Number.isSafeInteger(value) || value < 0 || value > 50) invalid(); return value; }
function proposal(body) {
  object(body, ['unit', 'values', 'explanation', 'expectedVersion']);
  const snapshot = measurements({ unit: body.unit, values: body.values });
  if (!snapshot.values.length) invalid();
  return { snapshot, explanation: text(body.explanation), expectedVersion: version(body.expectedVersion) };
}
function agreement(body) { object(body, ['version']); const v = version(body.version); if (!v) invalid(); return v; }
module.exports = { message, pagination, proposal, agreement };
