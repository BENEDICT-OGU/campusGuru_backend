
const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      enum: ['A', 'B', 'C', 'D', 'E'],
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  { _id: false }
);

const pastQuestionSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },

    topic: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    questionText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },

    questionType: {
      type: String,
      enum: ['mcq', 'true-false', 'fill-blank'],
      default: 'mcq',
      required: true,
    },

    options: {
      type: [optionSchema],
      default: [],
    },

    correctAnswer: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    acceptedAnswers: {
      type: [String],
      default: [],
    },

    explanation: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: '',
    },

    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },

    examYear: {
      type: Number,
      min: 1950,
      max: new Date().getFullYear() + 1,
      required: true,
    },

    examName: {
      type: String,
      trim: true,
      maxlength: 150,
      default: '',
    },

    questionNumber: {
      type: Number,
      min: 1,
      default: 1,
    },

    marks: {
      type: Number,
      min: 0,
      default: 1,
    },

    negativeMarks: {
      type: Number,
      min: 0,
      default: 0,
    },

    isPublished: {
      type: Boolean,
      default: false,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Validate the answer format before saving.
pastQuestionSchema.pre('validate', function () {
  if (this.questionType === 'mcq') {
    if (this.options.length < 2) {
      this.invalidate(
        'options',
        'MCQ questions must have at least two options.'
      );
    }

    const labels = this.options.map((option) => option.label);

    if (new Set(labels).size !== labels.length) {
      this.invalidate('options', 'Option labels must be unique.');
    }

    if (!labels.includes(this.correctAnswer.toUpperCase())) {
      this.invalidate(
        'correctAnswer',
        'The correct answer must match one of the option labels.'
      );
    }
  }

  if (this.questionType === 'true-false') {
    if (!['true', 'false'].includes(this.correctAnswer.toLowerCase())) {
      this.invalidate(
        'correctAnswer',
        'True/false answers must be true or false.'
      );
    }

    this.options = [];
  }

  if (this.questionType === 'fill-blank') {
    if (
      this.acceptedAnswers.length === 0 &&
      !this.correctAnswer.trim()
    ) {
      this.invalidate(
        'correctAnswer',
        'Provide at least one accepted answer.'
      );
    }

    this.options = [];
  }
});

pastQuestionSchema.index({
  course: 1,
  isPublished: 1,
  topic: 1,
  examYear: 1,
});

pastQuestionSchema.index({
  questionText: 'text',
  topic: 'text',
  explanation: 'text',
});

module.exports = mongoose.model('PastQuestion', pastQuestionSchema);
