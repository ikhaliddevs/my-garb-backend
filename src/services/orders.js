const { HttpError } = require('../middleware/errors');
const { measurements } = require('../validators/profile');
const { today } = require('../validators/orders');
const missing = () => { throw new HttpError(404, 'NOT_FOUND', 'Record not found'); };
const conflict = () => { throw new HttpError(409, 'INVALID_TRANSITION', 'Record cannot make this transition'); };
const amount = kobo => `${Math.floor(kobo / 100)}.${String(kobo % 100).padStart(2, '0')}`;
const participant = user => ({ [user.role === 'customer' ? 'customerId' : 'designerId']: user.id });
const snapshotView = snapshot => ({ unit: snapshot.unit, values: snapshot.values.map(v => ({ label: v.label, value: v.value })), capturedAt: snapshot.capturedAt });
function requestView(record, detail = true) {
  const result = { id: String(record._id), customerId: String(record.customerId), designerId: String(record.designerId), status: record.status,
    outfitType: record.outfitType, quantity: record.quantity, desiredCompletionDate: record.desiredCompletionDate,
    budgetAmount: amount(record.budgetKobo), currency: 'NGN', createdAt: record.createdAt, updatedAt: record.updatedAt };
  if (record.proposal) result.proposal = { priceAmount: amount(record.proposal.priceKobo), completionDate: record.proposal.completionDate };
  if (record.status === 'confirmed') result.orderId = String(record._id);
  if (detail) Object.assign(result, { description: record.description, referenceImageUrls: record.referenceImageUrls,
    measurementSnapshot: snapshotView(record.measurementSnapshot), responseText: record.responseText || null,
    decidedAt: record.decidedAt || null, cancelledAt: record.cancelledAt || null, confirmedAt: record.confirmedAt || null });
  return result;
}
function orderView(record, detail = true) {
  const result = { id: String(record._id), requestId: String(record.requestId), customerId: String(record.customerId), designerId: String(record.designerId),
    status: record.status, outfitType: record.outfitType, quantity: record.quantity, priceAmount: amount(record.priceKobo), currency: 'NGN',
    completionDate: record.completionDate, createdAt: record.createdAt, updatedAt: record.updatedAt };
  if (detail) Object.assign(result, { description: record.description, referenceImageUrls: record.referenceImageUrls,
    measurementSnapshot: snapshotView(record.measurementSnapshot), history: record.history.map(event => ({ status: event.status, actorId: String(event.actorId), at: event.at })) });
  return result;
}
function createOrderService({ User, Request, Order } = {}) {
  async function getRecord(Model, id, user) {
    const record = await Model.findOne({ _id: id, ...participant(user) }).lean();
    if (!record) missing();
    return record;
  }
  async function materialize(record) {
    // Durable intent is committed first. Every retry uses the same frozen terms and IDs.
    const document = { _id: record._id, requestId: record._id, customerId: record.customerId, designerId: record.designerId,
      outfitType: record.outfitType, description: record.description, quantity: record.quantity, referenceImageUrls: record.referenceImageUrls,
      priceKobo: record.proposal.priceKobo, completionDate: record.proposal.completionDate, measurementSnapshot: record.measurementSnapshot,
      status: 'confirmed', createdAt: record.confirmedAt, updatedAt: record.confirmedAt,
      history: [{ status: 'confirmed', actorId: record.confirmedBy, at: record.confirmedAt }] };
    try {
      return await Order.findOneAndUpdate({ requestId: record._id }, { $setOnInsert: document },
        { upsert: true, returnDocument: 'after', runValidators: true, timestamps: false }).lean();
    } catch (error) {
      if (error.code === 11000) {
        const existing = await Order.findOne({ requestId: record._id }).lean();
        if (existing) return existing;
      }
      throw error;
    }
  }
  return {
    async submit(user, input) {
      const designer = await User.exists({ _id: input.designerId, role: 'designer', status: 'active',
        'designer.businessName': { $type: 'string', $ne: '' }, 'designer.location': { $type: 'string', $ne: '' },
        'designer.specialties.0': { $exists: true }, 'designer.portfolio.0': { $exists: true } });
      if (!designer) throw new HttpError(409, 'DESIGNER_UNAVAILABLE', 'Designer is not eligible for a new request');
      const owner = await User.findOne({ _id: user.id, role: 'customer', status: 'active' }).select('+measurements').lean();
      if (!owner) throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication required');
      if (!owner.measurements?.values?.length) throw new HttpError(409, 'MEASUREMENTS_REQUIRED', 'Save a nonempty measurement set before sharing');
      const validated = measurements({ unit: owner.measurements.unit, values: owner.measurements.values });
      const record = await Request.create({ ...input, customerId: user.id, measurementSnapshot: { ...validated, capturedAt: new Date() } });
      return requestView(record.toObject());
    },
    async list(user, input, orders = false) {
      const filter = { ...participant(user), ...(input.status ? { status: input.status } : {}) };
      const records = await (orders ? Order : Request).find(filter).select('-measurementSnapshot -description -referenceImageUrls -responseText -history')
        .sort({ _id: 1 }).skip((input.page - 1) * input.limit).limit(input.limit + 1).maxTimeMS(3000).lean();
      return { [orders ? 'orders' : 'requests']: records.slice(0, input.limit).map(r => orders ? orderView(r, false) : requestView(r, false)),
        page: input.page, limit: input.limit, hasMore: records.length > input.limit };
    },
    async detail(user, id, orders = false) {
      const record = await getRecord(orders ? Order : Request, id, user);
      if (orders) return orderView(record);
      const result = requestView(record);
      if (record.status === 'confirmed') result.orderPending = !await Order.exists({ requestId: record._id });
      return result;
    },
    async decide(user, id, input) {
      await getRecord(Request, id, user);
      const record = await Request.findOneAndUpdate({ _id: id, designerId: user.id, status: 'submitted' },
        { $set: { ...input, decidedAt: new Date(), decidedBy: user.id } }, { returnDocument: 'after', runValidators: true }).lean();
      if (!record) conflict();
      return requestView(record);
    },
    async cancel(user, id) {
      await getRecord(Request, id, user);
      const record = await Request.findOneAndUpdate({ _id: id, customerId: user.id, status: { $in: ['submitted', 'accepted'] } },
        { $set: { status: 'cancelled', cancelledAt: new Date(), cancelledBy: user.id } }, { returnDocument: 'after', runValidators: true }).lean();
      if (!record) conflict();
      return requestView(record);
    },
    async confirm(user, id) {
      let record = await getRecord(Request, id, user);
      if (record.status !== 'confirmed') {
        if (record.status !== 'accepted') conflict();
        if (!await User.exists({ _id: record.designerId, role: 'designer', status: 'active' })) throw new HttpError(409, 'DESIGNER_UNAVAILABLE', 'Designer is not active');
        record = await Request.findOneAndUpdate({ _id: id, customerId: user.id, status: 'accepted', 'proposal.completionDate': { $gt: today() } },
          { $set: { status: 'confirmed', confirmedAt: new Date(), confirmedBy: user.id } }, { returnDocument: 'after', runValidators: true }).lean();
        if (!record) record = await getRecord(Request, id, user);
        if (record.status !== 'confirmed') conflict();
      }
      try { return orderView(await materialize(record)); }
      catch { throw new HttpError(503, 'CONFIRMATION_PENDING', 'Confirmation is recorded; retry this confirmation to recover the order'); }
    },
    async transition(user, id, status) {
      const expectedRole = status === 'completed' ? 'customer' : 'designer';
      if (user.role !== expectedRole) throw new HttpError(403, 'FORBIDDEN', 'Access denied');
      const current = await getRecord(Order, id, user);
      if (current.status === status) return orderView(current);
      const previous = { in_progress: 'confirmed', ready: 'in_progress', completed: 'ready' }[status];
      const record = await Order.findOneAndUpdate({ _id: id, ...participant(user), status: previous },
        { $set: { status }, $push: { history: { status, actorId: user.id, at: new Date() } } }, { returnDocument: 'after', runValidators: true }).lean();
      if (record) return orderView(record);
      const latest = await getRecord(Order, id, user);
      if (latest.status === status) return orderView(latest);
      conflict();
    },
  };
}
module.exports = { createOrderService };
