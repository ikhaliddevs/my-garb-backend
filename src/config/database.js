const mongoose = require('mongoose');
const { createAuthModels } = require('../models/auth');

function createDatabase() {
  const client = new mongoose.Mongoose();
  const models = createAuthModels(client);
  return {
    models,
    prepareAuth: async () => {
      await models.User.createIndexes();
      await models.Session.createIndexes();
    },
    isReady: () => client.connection.readyState === 1,
    async connect(uri) {
      try {
        await client.connect(uri, { serverSelectionTimeoutMS: 5000 });
      } catch {
        await client.disconnect();
        throw new Error('MongoDB connection failed; check database service and configuration');
      }
    },
    close: () => client.disconnect(),
  };
}

module.exports = { createDatabase };
