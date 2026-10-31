
const mongoose = require('mongoose');

const examOptionSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

// A private snapshot of each question at the time the exam starts.
// Correct answers are stored in MongoDB, never sent to the student
// while the exam is in progress.
const examQuestionSchema = new mongoose.Schema(
  {
    originalQuestion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PastQuestion',
      required: true,
    },

    questionText: {
      type: String,
      required: true,
    },

    questionType: {
      type: String,
      enum: ['mcq', 'true-false', 'fill-blank'],
      required: true,
    },

    options: {
      type: [examOptionSchema],
      default: [],
    },

    correctAnswer: {
      type: String,
      required: true,
    },

    acceptedAnswers: {
      type: [String],
      default: [],
    },

    explanation: {
      type: String,
      default: '',
    },

    selectedAnswer: {
      type: String,
      default: '',
    },

    isCorrect: {
      type: Boolean,
      default: null,
    },

    marks: {
      type: Number,
      default: 1,
      min: 0,
    },

    negativeMarks: {
      type: Number,
      default: 0,
      min: 0,
    },

    marksAwarded: {
      type: Number,
      default: 0,
    },

    questionNumber: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const examAttemptSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    mode: {
      type: String,
      enum: [
        'practice',
        'mock',
        'past-questions',
        'quiz',
        'full-exam',
      ],
      required: true,
    },

    configuration: {
      courseIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Course',
        },
      ],

      topics: {
        type: [String],
        default: [],
      },

      questionCount: {
        type: Number,
        required: true,
        min: 1,
        max: 100,
      },

      durationMinutes: {
        type: Number,
        required: true,
        min: 1,
        max: 180,
      },

      difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard', 'mixed'],
        default: 'mixed',
      },

      questionTypes: {
        type: [String],
        default: ['mcq'],
      },

      negativeMarking: {
        type: Boolean,
        default: false,
      },

      shuffleQuestions: {
        type: Boolean,
        default: true,
      },
    },

    questions: {
      type: [examQuestionSchema],
      required: true,
    },

    status: {
      type: String,
      enum: ['in-progress', 'submitted', 'expired'],
      default: 'in-progress',
      index: true,
    },

    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    totalMarks: {
      type: Number,
      default: 0,
      min: 0,
    },

    score: {
      type: Number,
      default: 0,
    },

    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    correctCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    wrongCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    unansweredCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    progressRecorded: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

examAttemptSchema.index({
  student: 1,
  createdAt: -1,
});

examAttemptSchema.index({
  student: 1,
  status: 1,
});

module.exports = mongoose.model(
  'ExamAttempt',
  examAttemptSchema
);
