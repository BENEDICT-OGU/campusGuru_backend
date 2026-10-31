
const mongoose = require('mongoose');

async function connectDB() {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    throw new Error('MONGODB_URI is missing from your .env file.');
  }

  await mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log('MongoDB connected successfully!');
  console.log(`Database: ${mongoose.connection.name}`);
}

module.exports = connectDB;
