
const express = require('express');

const router = express.Router();

const { protect } = require('../middleware/authMiddleware');

const {
  startExam,
  getExam,
  saveAnswer,
  submitExam,
  getExamHistory,
  getExamAnalytics,
} = require('../controllers/examController');
// All examination routes require authentication.
router.use(protect);

// Start a new examination.
router.post('/start', startExam);

// View examination history.
router.get('/history', getExamHistory);

// View examination analytics.
router.get('/analytics', getExamAnalytics);

// View an examination or its final result.
router.get('/:id', getExam);

// Save an answer.
router.patch('/:id/answer', saveAnswer);

// Submit an examination.
router.post('/:id/submit', submitExam);

module.exports = router;
