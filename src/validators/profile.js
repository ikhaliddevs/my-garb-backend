const { isIP } = require('node:net');
const { HttpError } = require('../middleware/errors');

function invalid() { throw new HttpError(400, 'INVALID_INPUT', 'Invalid profile, portfolio, measurement or discovery input'); }
function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) invalid();
  return value;
}
function text(value, max, empty = false) {
  if (typeof value !== 'string' || value.length > max || [...value].some(char => char.codePointAt(0) < 32 || char.codePointAt(0) === 127)) invalid();
  const result = value.trim();
  if (!empty && !result) invalid();
  return result;
}
function profile(value, role) {
  const keys = role === 'customer' ? ['name', 'phone'] : ['businessName', 'biography', 'location', 'specialties', 'available'];
  object(value, keys);
  if (!Object.keys(value).length) invalid();
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === 'available') {
      if (typeof item !== 'boolean') invalid();
      result[key] = item;
    } else if (key === 'specialties') {
      if (!Array.isArray(item) || item.length > 10) invalid();
      result[key] = item.map(entry => text(entry, 60));
      if (new Set(result[key].map(entry => entry.toLowerCase())).size !== item.length) invalid();
    } else if (key === 'phone') {
      result[key] = text(item, 30, true);
      if (result[key] && !/^\+?[0-9() .-]{3,30}$/.test(result[key])) invalid();
    } else result[key] = text(item, key === 'biography' ? 2000 : 100, key !== 'name');
  }
  return result;
}
function portfolio(value) {
  object(value, ['title', 'category', 'imageUrl']);
  const result = { title: text(value.title, 100), category: text(value.category, 60), imageUrl: text(value.imageUrl, 2048) };
  let url;
  try { url = new URL(result.imageUrl); } catch { invalid(); }
  // Store external HTTPS references only. Never fetch them on the server.
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || (url.port && url.port !== '443') ||
      isIP(host) || host.includes(':') || !host.includes('.') || host.endsWith('.') ||
      /(^|\.)(localhost|local|internal|test|invalid)$/.test(host) || !/^[a-z0-9.-]+$/.test(host)) invalid();
  result.imageUrl = url.href;
  return result;
}
function measurements(value) {
  object(value, ['unit', 'values']);
  if (!['cm', 'in'].includes(value.unit) || !Array.isArray(value.values) || value.values.length > 50) invalid();
  const values = value.values.map(entry => {
    object(entry, ['label', 'value']);
    const label = text(entry.label, 60);
    if (typeof entry.value !== 'number' || !Number.isFinite(entry.value) || entry.value <= 0 || entry.value > 1000) invalid();
    return { label, value: entry.value };
  });
  if (new Set(values.map(entry => entry.label.toLowerCase())).size !== values.length) invalid();
  return { unit: value.unit, values };
}
function discovery(value) {
  object(value, ['q', 'location', 'available', 'page', 'limit']);
  const result = { page: 1, limit: 20 };
  for (const key of ['q', 'location']) if (value[key] !== undefined) result[key] = text(value[key], 100);
  if (value.available !== undefined) {
    if (!['true', 'false'].includes(value.available)) invalid();
    result.available = value.available === 'true';
  }
  for (const [key, max] of [['page', 1000], ['limit', 50]]) {
    if (value[key] !== undefined) {
      if (typeof value[key] !== 'string' || !/^[1-9]\d*$/.test(value[key]) || Number(value[key]) > max) invalid();
      result[key] = Number(value[key]);
    }
  }
  return result;
}
function id(value) { if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) invalid(); return value; }
module.exports = { profile, portfolio, measurements, discovery, id, object };
