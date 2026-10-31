
const express = require('express');
const router = express.Router();

const {
  sendMessage,
  getConversations,
  getConversation,
  renameConversation,
  deleteConversation,
} = require('../controllers/aiController');

const { protect } = require('../middleware/authMiddleware');

// All AI routes require authentication.
router.use(protect);

// Send a message to the AI.
router.post('/chat', sendMessage);

// Conversation management.
router.get('/conversations', getConversations);
router.get('/conversations/:id', getConversation);
router.patch('/conversations/:id', renameConversation);
router.delete('/conversations/:id', deleteConversation);

module.exports = router;
