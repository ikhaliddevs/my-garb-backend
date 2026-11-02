const { Types } = require('mongoose');
const { HttpError } = require('../middleware/errors');
const { event } = require('./events');
const participant = user => ({ [user.role === 'customer' ? 'customerId' : 'designerId']: user.id });
const missing = () => { throw new HttpError(404, 'NOT_FOUND', 'Record not found'); };
const conflict = () => { throw new HttpError(409, 'CONVERSATION_CONFLICT', 'Conversation closed, full, or agreement version no longer current'); };
const message = (user, text, kind = 'text', version) => ({ _id: new Types.ObjectId(), actorId: user.id, text, kind, ...(version ? { version } : {}), at: new Date() });
const messageView = m => ({ id: String(m._id), actorId: String(m.actorId), text: m.text, kind: m.kind, version: m.version || null, at: m.at });
const snapshotView = s => ({ unit: s.unit, values: s.values.map(v => ({ label: v.label, value: v.value })), capturedAt: s.capturedAt });
const amendmentView = a => ({ version: a.version, measurements: snapshotView(a.snapshot), designerId: String(a.designerId), customerId: String(a.customerId),
  proposedAt: a.proposedAt, proposalMessageId: String(a.proposalMessageId), consentMessageId: a.consentMessageId ? String(a.consentMessageId) : null,
  acceptedAt: a.acceptedAt || null, withdrawnAt: a.withdrawnAt || null, supersededAt: a.supersededAt || null });
function page(items, input) { const start = (input.page - 1) * input.limit; return { items: items.slice(start, start + input.limit), page: input.page, limit: input.limit, hasMore: items.length > start + input.limit }; }
function createCommunicationService({ Request, Order, Notification } = {}) {
  async function owned(Model, user, id) {
    const r = await Model.findOne({ _id: id, ...participant(user) }).lean();
    if (!r) missing(); return r;
  }
  function newMessageEvent(r, user, order, at) { return event('new_message', user.role === 'customer' ? r.designerId : r.customerId, r.requestId || r._id, order ? r._id : undefined, at); }
  async function deliver(user) {
    // Outbox entries exist only for writes made by M5. Polling retries pending entries;
    // no historical status inference/backfill and no transaction or startup worker.
    let remaining = 100;
    for (const Model of [Request, Order]) {
      const sources = await Model.find({ events: { $elemMatch: { recipientId: user.id, delivered: false } } })
        .select('events').sort({ _id: 1 }).limit(20).maxTimeMS(3000).lean();
      for (const source of sources) for (const e of source.events.filter(e => String(e.recipientId) === user.id && !e.delivered)) {
        if (remaining-- <= 0) return;
        try {
          await Notification.updateOne({ eventId: e._id }, { $setOnInsert: { _id: e._id, eventId: e._id, recipientId: e.recipientId,
            type: e.type, requestId: e.requestId, orderId: e.orderId, at: e.at, readAt: null } }, { upsert: true, runValidators: true });
        } catch (error) { if (error.code !== 11000) throw error; }
        // A crash after insertion is safe: the same event ID is upserted again.
        await Model.updateOne({ _id: source._id, 'events._id': e._id }, { $set: { 'events.$.delivered': true } }, { timestamps: false });
      }
    }
  }
  return {
    async messages(user, id, input) {
      const r = await owned(Request, user, id);
      const o = r.status === 'confirmed' ? await Order.findOne({ requestId: id, ...participant(user) }).lean() : null;
      // Request-phase writes atomically stop at confirmation; order-phase writes start after it.
      const all = [...(r.messages || []), ...(o?.messages || [])];
      const result = page(all.map(messageView), input);
      return { requestId: id, orderId: r.status === 'confirmed' ? id : null, messages: result.items, page: result.page, limit: result.limit, hasMore: result.hasMore };
    },
    async send(user, id, text) {
      const r = await owned(Request, user, id);
      const order = r.status === 'confirmed';
      const Model = order ? Order : Request;
      const m = message(user, text);
      const record = await Model.findOneAndUpdate({ _id: id, ...participant(user), status: { $in: order ? ['confirmed', 'in_progress', 'ready'] : ['submitted', 'accepted'] }, 'messages.499': { $exists: false },
        ...(order ? { $or: [{ pendingAmendment: null }, { 'messages.498': { $exists: false } }] } : {}) },
        { $push: { messages: m, events: newMessageEvent(r, user, order, m.at) } }, { returnDocument: 'after', runValidators: true }).lean();
      if (!record) conflict();
      return { requestId: id, orderId: order ? id : null, message: messageView(m) };
    },
    async amendments(user, id, input) {
      const r = await owned(Order, user, id);
      const result = page((r.amendments || []).map(amendmentView), input);
      return { originalMeasurements: snapshotView(r.measurementSnapshot), effectiveMeasurements: snapshotView([...(r.amendments || [])].reverse().find(a => a.acceptedAt)?.snapshot || r.measurementSnapshot),
        version: r.amendmentVersion || 0, pendingVersion: r.pendingAmendment || null, amendments: result.items, page: result.page, limit: result.limit, hasMore: result.hasMore };
    },
    async propose(user, id, input) {
      const r = await owned(Order, user, id);
      const version = input.expectedVersion + 1;
      if (version > 50) conflict();
      const m = message(user, input.explanation, 'proposal', version);
      const a = { version, snapshot: { ...input.snapshot, capturedAt: m.at }, designerId: user.id, customerId: r.customerId, proposedAt: m.at, proposalMessageId: m._id };
      const amendments = [...(r.amendments || [])];
      // Existing accepted records are never modified. Only a pending proposal may be superseded.
      if (r.pendingAmendment) amendments[amendments.findIndex(a => a.version === r.pendingAmendment)].supersededAt = m.at;
      const set = { amendmentVersion: version, pendingAmendment: version, amendments: [...amendments, a] };
      const updated = await Order.findOneAndUpdate({ _id: id, designerId: user.id, status: 'confirmed',
        $or: [{ amendmentVersion: input.expectedVersion }, ...(input.expectedVersion === 0 ? [{ amendmentVersion: { $exists: false } }] : [])],
        pendingAmendment: r.pendingAmendment || null, 'messages.498': { $exists: false } },
      { $set: set, $push: { messages: m, events: newMessageEvent(r, user, true, m.at) } }, { returnDocument: 'after', runValidators: true }).lean();
      if (!updated) conflict(); return amendmentView(a);
    },
    async agree(user, id, version, withdraw = false) {
      const r = await owned(Order, user, id);
      const a = (r.amendments || []).find(a => a.version === version);
      if (!a) conflict();
      // Safe same-operation retry; never changes a newer proposal or production data.
      if (withdraw ? a.withdrawnAt : a.acceptedAt) return amendmentView(a);
      const m = message(user, withdraw ? `Withdraw measurement proposal version ${version}.` : `I agree to the exact measurements in proposal version ${version}.`, withdraw ? 'withdrawal' : 'consent', version);
      const index = r.amendments.findIndex(a => a.version === version);
      const set = { pendingAmendment: null, ['amendments.' + index + (withdraw ? '.withdrawnAt' : '.acceptedAt')]: m.at };
      if (!withdraw) set['amendments.' + index + '.consentMessageId'] = m._id;
      const updated = await Order.findOneAndUpdate({ _id: id, ...participant(user), status: 'confirmed', pendingAmendment: version, amendmentVersion: version, 'messages.499': { $exists: false } },
        { $set: set, $push: { messages: m, events: newMessageEvent(r, user, true, m.at) } }, { returnDocument: 'after', runValidators: true }).lean();
      if (!updated) {
        const latest = await owned(Order, user, id);
        const done = latest.amendments.find(a => a.version === version);
        if (withdraw ? done?.withdrawnAt : done?.acceptedAt) return amendmentView(done);
        conflict();
      }
      return amendmentView(updated.amendments[index]);
    },
    async notifications(user, input) {
      try { await deliver(user); } catch { throw new HttpError(503, 'NOTIFICATIONS_PENDING', 'Notification delivery pending; retry polling'); }
      const records = await Notification.find({ recipientId: user.id }).sort({ _id: 1 }).skip((input.page - 1) * input.limit).limit(input.limit + 1).maxTimeMS(3000).lean();
      return { notifications: records.slice(0, input.limit).map(r => ({ id: String(r._id), type: r.type, requestId: String(r.requestId), orderId: r.orderId ? String(r.orderId) : null, at: r.at, readAt: r.readAt })),
        page: input.page, limit: input.limit, hasMore: records.length > input.limit,
        deliveryPending: !!(await Request.exists({ events: { $elemMatch: { recipientId: user.id, delivered: false } } }) || await Order.exists({ events: { $elemMatch: { recipientId: user.id, delivered: false } } })) };
    },
    async read(user, id) {
      await Notification.updateOne({ _id: id, recipientId: user.id, readAt: null }, { $set: { readAt: new Date() } });
      const r = await Notification.findOne({ _id: id, recipientId: user.id }).lean();
      if (!r) missing(); return { id: String(r._id), readAt: r.readAt };
    },
  };
}
module.exports = { createCommunicationService };
