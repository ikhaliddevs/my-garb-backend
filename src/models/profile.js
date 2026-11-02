function profileFields(Schema) {
  const portfolio = new Schema({
    title: { type: String, required: true, maxlength: 100 },
    category: { type: String, required: true, maxlength: 60 },
    imageUrl: { type: String, required: true, maxlength: 2048 },
  });
  const measurement = new Schema({ label: { type: String, required: true, maxlength: 60 }, value: { type: Number, required: true, min: Number.MIN_VALUE, max: 1000 } }, { _id: false });
  return {
    phone: { type: String, maxlength: 30, default: '', select: false },
    designer: {
      businessName: { type: String, default: '', maxlength: 100 },
      biography: { type: String, default: '', maxlength: 2000 },
      location: { type: String, default: '', maxlength: 100 },
      specialties: { type: [String], default: [], validate: value => value.length <= 10 },
      available: { type: Boolean, default: false },
      portfolio: { type: [portfolio], default: [], validate: value => value.length <= 50 },
    },
    measurements: {
      type: new Schema({ unit: { type: String, enum: ['cm', 'in'], required: true }, values: { type: [measurement], validate: value => value.length <= 50 }, updatedAt: Date }, { _id: false }),
      default: undefined,
      select: false,
    },
  };
}
module.exports = { profileFields };
