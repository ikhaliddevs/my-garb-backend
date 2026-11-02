const { object, discovery } = require('./profile');
const { HttpError } = require('../middleware/errors');
function status(body) {
  object(body, ['status']);
  if (!['active', 'suspended'].includes(body.status)) throw new HttpError(400, 'INVALID_INPUT', 'Invalid account status');
  return body.status;
}
function list(query) {
  object(query, ['page', 'limit']);
  return discovery(query);
}
module.exports = { status, list };
