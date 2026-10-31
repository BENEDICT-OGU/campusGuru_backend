
const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Course title is required'],
      trim: true,
      minlength: 2,
      maxlength: 120,
    },

    courseCode: {
      type: String,
      required: [true, 'Course code is required'],
      trim: true,
      uppercase: true,
      maxlength: 20,
      unique: true,
    },

    faculty: {
      type: String,
      required: [true, 'Faculty is required'],
      trim: true,
      maxlength: 120,
    },

    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
      maxlength: 120,
    },

    level: {
      type: Number,
      required: true,
      enum: [100, 200, 300, 400, 500],
    },

    semester: {
      type: String,
      required: true,
      enum: ['first', 'second'],
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    coverImage: {
      type: String,
      trim: true,
      default: '',
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

courseSchema.index({ isPublished: 1, level: 1, semester: 1 });
courseSchema.index({ title: 'text', courseCode: 'text' });

module.exports = mongoose.model('Course', courseSchema);
