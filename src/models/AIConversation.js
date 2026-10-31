
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 12000,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const aiConversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    title: {
      type: String,
      default: 'New conversation',
      trim: true,
      maxlength: 120,
    },

    context: {
      type: {
        type: String,
        enum: [
          'general',
          'past-question',
          'study-material',
          'exam-result',
        ],
        default: 'general',
      },

      courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        default: null,
      },

      referenceId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
      },

      topic: {
        type: String,
        default: '',
        trim: true,
        maxlength: 150,
      },
    },

    messages: {
      type: [messageSchema],
      default: [],
    },

    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

aiConversationSchema.index({
  user: 1,
  lastMessageAt: -1,
});

module.exports = mongoose.model(
  'AIConversation',
  aiConversationSchema
);
