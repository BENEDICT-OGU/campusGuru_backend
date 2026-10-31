
const mongoose = require('mongoose');

const AIConversation = require('../models/AIConversation');
const { generateAIResponse } = require('../services/aiService');

// POST /api/ai/chat
// Send a message and receive an AI response.
const sendMessage = async (req, res) => {
  let conversation = null;
  let isNewConversation = false;

  try {
    const { message, conversationId, topic } = req.body;

    // Validate message.
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a message.',
      });
    }

    const cleanMessage = message.trim();

    if (cleanMessage.length > 4000) {
      return res.status(400).json({
        success: false,
        message: 'Your message cannot exceed 4,000 characters.',
      });
    }

    // Validate conversation ID when supplied.
    if (conversationId && !mongoose.isValidObjectId(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID.',
      });
    }

    // Load an existing conversation owned by this student.
    if (conversationId) {
      conversation = await AIConversation.findOne({
        _id: conversationId,
        user: req.user._id,
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found.',
        });
      }
    } else {
      // Create a new conversation.
      conversation = new AIConversation({
        user: req.user._id,
        title: cleanMessage.substring(0, 60),
        contextType: 'general',
        topic: typeof topic === 'string' ? topic.trim().substring(0, 150) : '',
        messages: [],
      });

      isNewConversation = true;
    }

    // Only use messages stored on the server.
    const conversationMessages = conversation.messages.map((item) => ({
      role: item.role,
      content: item.content,
    }));

    conversationMessages.push({
      role: 'user',
      content: cleanMessage,
    });

    // Generate the AI response.
    const aiResult = await generateAIResponse({
  messages: conversationMessages,
  context: {
    type: 'general',
    topic: conversation.topic || '',
  },
});

    if (!aiResult || !aiResult.content) {
      throw new Error('The AI provider returned an empty response.');
    }

    // Save both messages only after receiving a successful response.
    conversation.messages.push(
      {
        role: 'user',
        content: cleanMessage,
      },
      {
        role: 'assistant',
        content: aiResult.content,
      }
    );

    conversation.lastMessageAt = new Date();

    await conversation.save();

    return res.status(200).json({
      success: true,
      message: 'AI response generated successfully.',
      conversationId: conversation._id,
      conversationTitle: conversation.title,
      reply: aiResult.content,
      model: aiResult.model,
      usage: aiResult.usage || null,
    });
  } catch (error) {
    console.error('AI chat error:', error.message);

    // Remove a newly created conversation if the AI request failed.
    if (isNewConversation && conversation?._id) {
      await AIConversation.deleteOne({
        _id: conversation._id,
        user: req.user._id,
      }).catch(() => {});
    }

    const status = error.status === 429 ? 429 : 500;

    return res.status(status).json({
      success: false,
      message:
        status === 429
          ? 'The AI service is currently rate-limited. Please try again later.'
          : 'Unable to generate an AI response. Please try again.',
    });
  }
};

// GET /api/ai/conversations
// Get the logged-in student's conversations.
const getConversations = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit, 10) || 20)
    );

    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      AIConversation.find({ user: req.user._id })
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('title contextType topic messages lastMessageAt createdAt')
        .lean(),

      AIConversation.countDocuments({ user: req.user._id }),
    ]);

    const formattedConversations = conversations.map((conversation) => {
      const lastMessage =
        conversation.messages?.[conversation.messages.length - 1];

      return {
        _id: conversation._id,
        title: conversation.title,
        contextType: conversation.contextType,
        topic: conversation.topic,
        lastMessage: lastMessage
          ? {
              role: lastMessage.role,
              content: lastMessage.content.substring(0, 150),
            }
          : null,
        lastMessageAt: conversation.lastMessageAt,
        createdAt: conversation.createdAt,
      };
    });

    return res.status(200).json({
      success: true,
      conversations: formattedConversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get AI conversations error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve conversations.',
    });
  }
};

// GET /api/ai/conversations/:id
// Get one conversation and its messages.
const getConversation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID.',
      });
    }

    const conversation = await AIConversation.findOne({
      _id: id,
      user: req.user._id,
    }).lean();

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.',
      });
    }

    return res.status(200).json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error('Get AI conversation error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve this conversation.',
    });
  }
};

// PATCH /api/ai/conversations/:id
// Rename a conversation.
const renameConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID.',
      });
    }

    if (
      typeof title !== 'string' ||
      !title.trim() ||
      title.trim().length > 120
    ) {
      return res.status(400).json({
        success: false,
        message: 'Title must contain between 1 and 120 characters.',
      });
    }

    const conversation = await AIConversation.findOneAndUpdate(
      {
        _id: id,
        user: req.user._id,
      },
      {
        $set: { title: title.trim() },
      },
      {
  returnDocument: 'after',
  runValidators: true,
}
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Conversation renamed successfully.',
      conversation,
    });
  } catch (error) {
    console.error('Rename AI conversation error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to rename this conversation.',
    });
  }
};

// DELETE /api/ai/conversations/:id
// Delete a conversation.
const deleteConversation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID.',
      });
    }

    const conversation = await AIConversation.findOneAndDelete({
      _id: id,
      user: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Conversation deleted successfully.',
    });
  } catch (error) {
    console.error('Delete AI conversation error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to delete this conversation.',
    });
  }
};

module.exports = {
  sendMessage,
  getConversations,
  getConversation,
  renameConversation,
  deleteConversation,
};
