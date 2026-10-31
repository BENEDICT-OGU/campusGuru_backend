
const mongoose = require('mongoose');

const studentProgressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    // Student learning goals
    dailyStudyGoalMinutes: {
      type: Number,
      default: 60,
      min: 15,
      max: 480,
    },

    weeklyStudyGoalMinutes: {
      type: Number,
      default: 600,
      min: 60,
      max: 3360,
    },

    // Study statistics (updated by future study services)
    totalStudyMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },

    completedTopics: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Study streak statistics
    currentStreak: {
      type: Number,
      default: 0,
      min: 0,
    },

    longestStreak: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastStudyDate: {
      type: Date,
      default: null,
    },

    // Exam statistics (updated by the future CBT system)
    completedExams: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalExamScore: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('StudentProgress', studentProgressSchema);
