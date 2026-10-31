
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('./src/config/db');

const authRoutes = require('./src/routes/authRoutes');
const profileRoutes = require('./src/routes/profileRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const courseRoutes = require('./src/routes/courseRoutes');
const studyMaterialRoutes = require('./src/routes/studyMaterialRoutes');
const pastQuestionRoutes = require('./src/routes/pastQuestionRoutes');
const examRoutes = require('./src/routes/examRoutes');
const aiRoutes = require('./src/routes/aiRoutes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '20kb' }));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to the CampusGuru API!',
    version: '1.0.0',
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'CampusGuru backend is running.',
    database:
      mongoose.connection.readyState === 1
        ? 'connected'
        : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/study-materials', studyMaterialRoutes);
app.use('/api/past-questions', pastQuestionRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/ai', aiRoutes);
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found.',
  });
});

async function startServer() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('JWT_SECRET is missing or too short in .env.');
    process.exit(1);
  }

  try {
    await connectDB();

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`CampusGuru API running at http://localhost:${PORT}`);
      console.log('Authentication routes are ready.');
      console.log('Profile routes are ready.');
    });
  } catch (error) {
    console.error('Failed to start CampusGuru backend:', error.message);
    process.exit(1);
  }
}

startServer();
