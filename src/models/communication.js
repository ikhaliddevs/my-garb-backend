function communicationSchemas(Schema) {
  const identifier = { type: Schema.Types.ObjectId, required: true };
  const message = new Schema({
    actorId: identifier, text: { type: String, required: true, maxlength: 2000 },
    kind: { type: String, enum: ['text', 'proposal', 'consent', 'withdrawal'], required: true },
    version: Number, at: { type: Date, required: true },
  });
  const event = new Schema({
    recipientId: identifier, type: { type: String, required: true },
    requestId: identifier, orderId: Schema.Types.ObjectId,
    at: { type: Date, required: true }, delivered: { type: Boolean, default: false },
  });
  return { messages: { type: [message], default: [] }, events: { type: [event], default: [] } };
}
function createCommunicationModels(client) {
  const { Schema } = client;
  const schema = new Schema({
    eventId: { type: Schema.Types.ObjectId, required: true, unique: true },
    recipientId: { type: Schema.Types.ObjectId, required: true }, type: { type: String, required: true },
    requestId: { type: Schema.Types.ObjectId, required: true }, orderId: Schema.Types.ObjectId,
    at: { type: Date, required: true }, readAt: { type: Date, default: null },
  }, { autoCreate: false, autoIndex: false, bufferCommands: false, writeConcern: { w: 1, j: true } });
  schema.index({ recipientId: 1, _id: 1 });
  return { Notification: client.model('Notification', schema) };
}
module.exports = { communicationSchemas, createCommunicationModels };
