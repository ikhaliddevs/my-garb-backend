function createOrderModels(client) {
  const { Schema } = client;
  // Acknowledged workflow writes must reach the standalone server's journal.
  const options = { timestamps: true, autoCreate: false, autoIndex: false, bufferCommands: false, writeConcern: { w: 1, j: true } };
  const identifier = () => ({ type: Schema.Types.ObjectId, required: true });
  const snapshot = new Schema({
    unit: { type: String, enum: ['cm', 'in'], required: true },
    values: { type: [new Schema({ label: { type: String, required: true, maxlength: 60 }, value: { type: Number, min: Number.MIN_VALUE, max: 1000, required: true } }, { _id: false })], validate: v => v.length >= 1 && v.length <= 50 },
    capturedAt: { type: Date, required: true },
  }, { _id: false });
  const outfit = () => ({
    outfitType: { type: String, required: true, maxlength: 100 }, description: { type: String, required: true, maxlength: 4000 },
    quantity: { type: Number, min: 1, max: 100, required: true, validate: Number.isInteger },
    referenceImageUrls: { type: [String], validate: v => v.length <= 5 },
  });
  const money = () => ({ type: Number, min: 1, max: 10000000000, required: true, validate: Number.isSafeInteger });
  const proposal = new Schema({ priceKobo: money(), completionDate: { type: String, required: true } }, { _id: false });
  const requestSchema = new Schema({
    customerId: identifier(), designerId: identifier(), ...outfit(),
    desiredCompletionDate: { type: String, required: true }, budgetKobo: money(),
    measurementSnapshot: { type: snapshot, required: true, immutable: true },
    status: { type: String, enum: ['submitted', 'accepted', 'declined', 'cancelled', 'confirmed'], default: 'submitted', required: true },
    responseText: { type: String, maxlength: 2000 }, proposal,
    decidedAt: Date, decidedBy: Schema.Types.ObjectId, cancelledAt: Date, cancelledBy: Schema.Types.ObjectId,
    confirmedAt: Date, confirmedBy: Schema.Types.ObjectId,
  }, options);
  const orderSchema = new Schema({
    requestId: { ...identifier(), unique: true }, customerId: identifier(), designerId: identifier(), ...outfit(),
    priceKobo: money(), completionDate: { type: String, required: true },
    measurementSnapshot: { type: snapshot, required: true, immutable: true },
    status: { type: String, enum: ['confirmed', 'in_progress', 'ready', 'completed'], required: true },
    history: { type: [new Schema({ status: { type: String, enum: ['confirmed', 'in_progress', 'ready', 'completed'], required: true }, actorId: identifier(), at: { type: Date, required: true } }, { _id: false })], validate: v => v.length >= 1 && v.length <= 4 },
  }, options);
  for (const schema of [requestSchema, orderSchema]) {
    schema.index({ customerId: 1, _id: 1 }); schema.index({ designerId: 1, _id: 1 });
    schema.index({ customerId: 1, status: 1, _id: 1 }); schema.index({ designerId: 1, status: 1, _id: 1 });
  }
  return { Request: client.model('OutfitRequest', requestSchema), Order: client.model('Order', orderSchema) };
}
module.exports = { createOrderModels };
