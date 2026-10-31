
const express = require('express');

const {
  getQuestions,
  getQuestion,
  getAdminQuestions,
  createQuestion,
  updateQuestion,
  checkAnswer,
  deleteQuestion,
} = require('../controllers/pastQuestionController');

const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');

const router = express.Router();

// Public student routes.
router.get('/', getQuestions);

// Admin route must come before /:id.
router.get('/admin', protect, adminOnly, getAdminQuestions);

// Practice answer checking.
router.post('/:id/check-answer', protect, checkAnswer);

// Individual question.
router.get('/:id', getQuestion);

// Administrator management.
router.post('/', protect, adminOnly, createQuestion);
router.patch('/:id', protect, adminOnly, updateQuestion);
router.delete('/:id', protect, adminOnly, deleteQuestion);

module.exports = router;
