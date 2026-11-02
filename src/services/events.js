const { Types } = require('mongoose');
function event(type, recipientId, requestId, orderId, at = new Date()) {
  return { _id: new Types.ObjectId(), type, recipientId, requestId, ...(orderId ? { orderId } : {}), at, delivered: false };
}
module.exports = { event };
