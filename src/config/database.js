const mongoose = require('mongoose');

function createDatabase() {
  const client = new mongoose.Mongoose();
  return {
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
