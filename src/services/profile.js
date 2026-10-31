const { HttpError } = require('../middleware/errors');

function missing() { throw new HttpError(404, 'NOT_FOUND', 'Record not found'); }
const portfolioView = entry => ({ id: String(entry._id), title: entry.title, category: entry.category, imageUrl: entry.imageUrl });
function designerView(user) {
  const data = user.designer || {};
  return { id: String(user._id), name: user.name, businessName: data.businessName || '', biography: data.biography || '',
    location: data.location || '', specialties: data.specialties || [], available: data.available || false, portfolio: (data.portfolio || []).map(portfolioView) };
}
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function createProfileService({ User } = {}) {
  const owner = user => ({ _id: user.id, role: user.role, status: 'active' });
  const select = 'name role designer';
  const view = user => user.role === 'designer' ? designerView(user) : { id: String(user._id), name: user.name, phone: user.phone || '' };
  const eligible = { role: 'designer', status: 'active', 'designer.businessName': { $type: 'string', $ne: '' },
    'designer.location': { $type: 'string', $ne: '' }, 'designer.specialties.0': { $exists: true }, 'designer.portfolio.0': { $exists: true } };
  return {
    async get(user) {
      const result = await User.findOne(owner(user)).select(select + ' +phone').lean();
      if (!result) missing();
      return view(result);
    },
    async patch(user, input) {
      const fields = Object.fromEntries(Object.entries(input).map(([key, value]) => [user.role === 'designer' ? `designer.${key}` : key, value]));
      const result = await User.findOneAndUpdate(owner(user), { $set: fields }, { returnDocument: 'after', runValidators: true }).select(select + ' +phone').lean();
      if (!result) missing();
      return view(result);
    },
    async addPortfolio(user, input) {
      const result = await User.findOneAndUpdate({ ...owner(user), 'designer.portfolio.49': { $exists: false } },
        { $push: { 'designer.portfolio': input } }, { returnDocument: 'after', runValidators: true }).select('designer.portfolio').lean();
      if (!result) throw new HttpError(409, 'PORTFOLIO_LIMIT', 'Portfolio limit reached or account unavailable');
      return portfolioView(result.designer.portfolio.at(-1));
    },
    async deletePortfolio(user, id) {
      const result = await User.updateOne({ ...owner(user), 'designer.portfolio._id': id }, { $pull: { 'designer.portfolio': { _id: id } } });
      if (!result.matchedCount) missing();
    },
    async getMeasurements(user) {
      const result = await User.findOne(owner(user)).select('+measurements').lean();
      if (!result) missing();
      return result.measurements || null;
    },
    async putMeasurements(user, input) {
      const result = await User.findOneAndUpdate(owner(user), { $set: { measurements: { ...input, updatedAt: new Date() } } },
        { returnDocument: 'after', runValidators: true }).select('+measurements').lean();
      if (!result) missing();
      return result.measurements;
    },
    async list(input) {
      const filter = { ...eligible };
      if (input.q) filter.$or = ['name', 'designer.businessName', 'designer.specialties'].map(key => ({ [key]: { $regex: escapeRegex(input.q), $options: 'i' } }));
      if (input.location) filter['designer.location'] = { $regex: `^${escapeRegex(input.location)}$`, $options: 'i' };
      if (input.available !== undefined) filter['designer.available'] = input.available;
      const results = await User.find(filter).select(select).sort({ _id: 1 }).skip((input.page - 1) * input.limit).limit(input.limit + 1).maxTimeMS(3000).lean();
      return { designers: results.slice(0, input.limit).map(designerView), page: input.page, limit: input.limit, hasMore: results.length > input.limit };
    },
    async detail(id) {
      const result = await User.findOne({ ...eligible, _id: id }).select(select).lean();
      if (!result) missing();
      return designerView(result);
    },
  };
}
module.exports = { createProfileService };
