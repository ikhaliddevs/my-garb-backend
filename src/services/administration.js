const { HttpError } = require('../middleware/errors');
const userView = user => ({ id: String(user._id), name: user.name, role: user.role, status: user.status, createdAt: user.createdAt, updatedAt: user.updatedAt });
const workflowView = row => ({ id: String(row._id), ...(row.requestId ? { requestId: String(row.requestId) } : {}), customerId: String(row.customerId), designerId: String(row.designerId), status: row.status });
function createAdministrationService(models = {}) {
  async function list(kind, { page, limit }) {
    const users = kind === 'users';
    const Model = users ? models.User : kind === 'orders' ? models.Order : models.Request;
    const rows = await Model.find({}).select(users ? '_id name role status createdAt updatedAt' : '_id requestId customerId designerId status').sort({ _id: 1 }).skip((page - 1) * limit).limit(limit + 1).lean();
    return { [kind]: rows.slice(0, limit).map(users ? userView : workflowView), page, limit, hasMore: rows.length > limit };
  }
  async function changeStatus(id, status) {
    // Admin targets are excluded in the atomic predicate, including concurrent calls.
    // The epoch changes with suspension in the same journaled user write. No session
    // deletion/transaction is needed, and reactivation cannot revive stale cookies.
    const user = await models.User.findOneAndUpdate({ _id: id, role: { $in: ['customer', 'designer'] }, status: { $ne: status } },
      { $set: { status }, ...(status === 'suspended' ? { $inc: { sessionVersion: 1 } } : {}) }, { returnDocument: 'after', writeConcern: { w: 1, j: true } });
    if (user) return userView(user);
    const existing = await models.User.findById(id);
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'User not found');
    if (existing.role === 'admin') throw new HttpError(409, 'ADMIN_STATUS_PROTECTED', 'Administrator status cannot be changed');
    return userView(existing);
  }
  return { list, changeStatus };
}
module.exports = { createAdministrationService };
