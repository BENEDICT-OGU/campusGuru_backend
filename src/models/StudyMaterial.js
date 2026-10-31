
const mongoose = require('mongoose');

const studyMaterialSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: [true, 'Material title is required'],
      trim: true,
      minlength: 2,
      maxlength: 150,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    type: {
      type: String,
      required: true,
      enum: [
        'lecture-note',
        'pdf',
        'slides',
        'summary',
        'video',
        'external-link',
      ],
    },

    resourceUrl: {
      type: String,
      trim: true,
      required: [true, 'Resource URL is required'],
      maxlength: 2048,
    },

    fileName: {
      type: String,
      trim: true,
      maxlength: 255,
      default: '',
    },

    fileSize: {
      type: Number,
      min: 0,
      default: 0,
    },

    isPublished: {
      type: Boolean,
      default: false,
    },

    uploadedBy: {
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

studyMaterialSchema.index({
  course: 1,
  isPublished: 1,
  type: 1,
});

studyMaterialSchema.index({
  title: 'text',
  description: 'text',
});

module.exports = mongoose.model('StudyMaterial', studyMaterialSchema);
