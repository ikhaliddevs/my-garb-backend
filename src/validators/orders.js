const { HttpError } = require('../middleware/errors');
const profile = require('./profile');
function invalid() { throw new HttpError(400, 'INVALID_INPUT', 'Invalid request or order input'); }
function text(value, max) {
  if (typeof value !== 'string' || value.length > max || !value.trim() || [...value].some(c => c.codePointAt(0) < 32 || c.codePointAt(0) === 127)) invalid();
  return value.trim();
}
function money(value) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(value)) invalid();
  const [whole, fraction = ''] = value.split('.');
  const kobo = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(kobo) || kobo < 1 || kobo > 10000000000) invalid();
  return kobo;
}
function today() { return new Date().toISOString().slice(0, 10); }
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid();
  const parsed = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || value <= today() ||
      parsed.getTime() > new Date(today()).getTime() + 730 * 86400000) invalid();
  return value;
}
function submission(body) {
  profile.object(body, ['designerId', 'outfitType', 'description', 'quantity', 'desiredCompletionDate', 'budgetAmount', 'referenceImageUrls', 'shareMeasurements']);
  if (body.shareMeasurements !== true || !Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > 100) invalid();
  const urls = body.referenceImageUrls === undefined ? [] : body.referenceImageUrls;
  if (!Array.isArray(urls) || urls.length > 5) invalid();
  const referenceImageUrls = urls.map(imageUrl => profile.portfolio({ title: 'Reference', category: 'Reference', imageUrl }).imageUrl);
  if (new Set(referenceImageUrls).size !== referenceImageUrls.length) invalid();
  return { designerId: profile.id(body.designerId), outfitType: text(body.outfitType, 100), description: text(body.description, 4000),
    quantity: body.quantity, desiredCompletionDate: date(body.desiredCompletionDate), budgetKobo: money(body.budgetAmount), referenceImageUrls };
}
function decision(body) {
  profile.object(body, ['decision', 'responseText', 'priceAmount', 'completionDate']);
  if (!['accepted', 'declined'].includes(body.decision)) invalid();
  const result = { status: body.decision, responseText: text(body.responseText, 2000) };
  if (body.decision === 'accepted') result.proposal = { priceKobo: money(body.priceAmount), completionDate: date(body.completionDate) };
  else if (body.priceAmount !== undefined || body.completionDate !== undefined) invalid();
  return result;
}
function list(query, order = false) {
  profile.object(query, ['page', 'limit', 'status']);
  const result = profile.discovery(Object.fromEntries(Object.entries(query).filter(([key]) => key !== 'status')));
  if (query.status !== undefined) {
    const allowed = order ? ['confirmed', 'in_progress', 'ready', 'completed'] : ['submitted', 'accepted', 'declined', 'cancelled', 'confirmed'];
    if (!allowed.includes(query.status)) invalid();
    result.status = query.status;
  }
  return result;
}
function status(body) {
  profile.object(body, ['status']);
  if (!['in_progress', 'ready', 'completed'].includes(body.status)) invalid();
  return body.status;
}
module.exports = { submission, decision, list, status, today };
