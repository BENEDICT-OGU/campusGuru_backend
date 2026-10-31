
const mongoose = require('mongoose');
const PastQuestion = require('../models/PastQuestion');
const Course = require('../models/Course');

const allowedTypes = ['mcq', 'true-false', 'fill-blank'];
const allowedDifficulties = ['easy', 'medium', 'hard'];

function publicQuestion(question) {
  const data = question.toObject
    ? question.toObject()
    : { ...question };

  delete data.correctAnswer;
  delete data.acceptedAnswers;
  delete data.explanation;
  delete data.createdBy;

  return data;
}

// GET /api/past-questions
// Students can only see published questions from published courses.
async function getQuestions(req, res) {
  try {
    const page = Math.max(
      1,
      Number.parseInt(req.query.page, 10) || 1
    );

    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 20)
    );

    const filter = { isPublished: true };

    if (req.query.courseId !== undefined) {
      if (!mongoose.isValidObjectId(req.query.courseId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid course ID.',
        });
      }

      filter.course = req.query.courseId;
    }

    if (req.query.topic) {
      filter.topic = {
        $regex: String(req.query.topic).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        $options: 'i',
      };
    }

    if (req.query.year !== undefined) {
      const year = Number(req.query.year);

      if (!Number.isInteger(year)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid examination year.',
        });
      }

      filter.examYear = year;
    }

    if (req.query.type !== undefined) {
      if (!allowedTypes.includes(req.query.type)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid question type.',
        });
      }

      filter.questionType = req.query.type;
    }

    if (req.query.difficulty !== undefined) {
      if (!allowedDifficulties.includes(req.query.difficulty)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid difficulty level.',
        });
      }

      filter.difficulty = req.query.difficulty;
    }

    if (req.query.search !== undefined) {
      const search = String(req.query.search).trim();

      if (search.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Search term is too long.',
        });
      }

      if (search) {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        filter.$or = [
          { questionText: { $regex: escaped, $options: 'i' } },
          { topic: { $regex: escaped, $options: 'i' } },
        ];
      }
    }

    const publishedCourses = await Course.find({
      isPublished: true,
    }).distinct('_id');

    if (filter.course) {
      const matchingCourse = publishedCourses.some(
        (id) => id.toString() === filter.course.toString()
      );

      if (!matchingCourse) {
        return res.status(200).json({
          success: true,
          questions: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        });
      }
    } else {
      filter.course = { $in: publishedCourses };
    }

    const skip = (page - 1) * limit;

    const [questions, total] = await Promise.all([
      PastQuestion.find(filter)
        .select('-correctAnswer -acceptedAnswers -explanation -createdBy')
        .populate('course', 'title courseCode level semester')
        .sort({ examYear: -1, questionNumber: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      PastQuestion.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      questions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get past questions error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve past questions.',
    });
  }
}

// GET /api/past-questions/:id
async function getQuestion(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid question ID.',
      });
    }

    const publishedCourses = await Course.find({
      isPublished: true,
    }).distinct('_id');

    const question = await PastQuestion.findOne({
      _id: req.params.id,
      isPublished: true,
      course: { $in: publishedCourses },
    })
      .select('-correctAnswer -acceptedAnswers -explanation -createdBy')
      .populate('course', 'title courseCode level semester')
      .lean();

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Past question not found.',
      });
    }

    return res.status(200).json({
      success: true,
      question,
    });
  } catch (error) {
    console.error('Get past question error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve this question.',
    });
  }
}

// GET /api/past-questions/admin
// Administrators can view published and unpublished questions.
async function getAdminQuestions(req, res) {
  try {
    const page = Math.max(
      1,
      Number.parseInt(req.query.page, 10) || 1
    );

    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 20)
    );

    const filter = {};

    if (req.query.courseId !== undefined) {
      if (!mongoose.isValidObjectId(req.query.courseId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid course ID.',
        });
      }

      filter.course = req.query.courseId;
    }

    if (req.query.published === 'true') {
      filter.isPublished = true;
    } else if (req.query.published === 'false') {
      filter.isPublished = false;
    }

    const skip = (page - 1) * limit;

    const [questions, total] = await Promise.all([
      PastQuestion.find(filter)
        .populate('course', 'title courseCode level semester')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      PastQuestion.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      questions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get admin questions error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve questions.',
    });
  }
}

// POST /api/past-questions
async function createQuestion(req, res) {
  try {
    const {
      course,
      topic,
      questionText,
      questionType,
      options,
      correctAnswer,
      acceptedAnswers,
      explanation,
      difficulty,
      examYear,
      examName,
      questionNumber,
      marks,
      negativeMarks,
      isPublished,
    } = req.body;

    if (!mongoose.isValidObjectId(course)) {
      return res.status(400).json({
        success: false,
        message: 'A valid course ID is required.',
      });
    }

    const existingCourse = await Course.findById(course);

    if (!existingCourse) {
      return res.status(404).json({
        success: false,
        message: 'The selected course does not exist.',
      });
    }

    if (isPublished === true && !existingCourse.isPublished) {
      return res.status(400).json({
        success: false,
        message: 'Publish the course before publishing its questions.',
      });
    }

    const question = await PastQuestion.create({
      course,
      topic,
      questionText,
      questionType,
      options,
      correctAnswer,
      acceptedAnswers,
      explanation,
      difficulty,
      examYear,
      examName,
      questionNumber,
      marks,
      negativeMarks,
      isPublished: isPublished === true,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: 'Past question created successfully.',
      question,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error('Create past question error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to create past question.',
    });
  }
}

// PATCH /api/past-questions/:id
async function updateQuestion(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid question ID.',
      });
    }

    const allowedFields = [
      'course',
      'topic',
      'questionText',
      'questionType',
      'options',
      'correctAnswer',
      'acceptedAnswers',
      'explanation',
      'difficulty',
      'examYear',
      'examName',
      'questionNumber',
      'marks',
      'negativeMarks',
      'isPublished',
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one field to update.',
      });
    }

    const question = await PastQuestion.findById(req.params.id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Past question not found.',
      });
    }

    const targetCourseId = updates.course || question.course;
    const targetCourse = await Course.findById(targetCourseId);

    if (!targetCourse) {
      return res.status(404).json({
        success: false,
        message: 'The selected course does not exist.',
      });
    }

    const willBePublished =
      updates.isPublished === undefined
        ? question.isPublished
        : updates.isPublished;

    if (willBePublished === true && !targetCourse.isPublished) {
      return res.status(400).json({
        success: false,
        message: 'Publish the course before publishing its questions.',
      });
    }

    Object.assign(question, updates);
    await question.save();

    return res.status(200).json({
      success: true,
      message: 'Past question updated successfully.',
      question,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error('Update past question error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to update past question.',
    });
  }
}

// POST /api/past-questions/:id/check-answer
// Used for practice mode, not for final CBT exam scoring.
async function checkAnswer(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid question ID.',
      });
    }

    const { answer } = req.body;

    if (typeof answer !== 'string' || !answer.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Submit an answer.',
      });
    }

    const publishedCourses = await Course.find({
      isPublished: true,
    }).distinct('_id');

    const question = await PastQuestion.findOne({
      _id: req.params.id,
      isPublished: true,
      course: { $in: publishedCourses },
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Past question not found.',
      });
    }

    let isCorrect = false;

    if (question.questionType === 'mcq') {
      isCorrect =
        answer.trim().toUpperCase() ===
        question.correctAnswer.toUpperCase();
    } else if (question.questionType === 'true-false') {
      isCorrect =
        answer.trim().toLowerCase() ===
        question.correctAnswer.toLowerCase();
    } else if (question.questionType === 'fill-blank') {
      const accepted = [
        question.correctAnswer,
        ...question.acceptedAnswers,
      ].map((value) => value.trim().toLowerCase());

      isCorrect = accepted.includes(answer.trim().toLowerCase());
    }

    return res.status(200).json({
      success: true,
      isCorrect,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      marksAwarded: isCorrect ? question.marks : 0,
    });
  } catch (error) {
    console.error('Check answer error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to check your answer.',
    });
  }
}

// DELETE /api/past-questions/:id
async function deleteQuestion(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid question ID.',
      });
    }

    const question = await PastQuestion.findByIdAndDelete(
      req.params.id
    );

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Past question not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Past question deleted successfully.',
    });
  } catch (error) {
    console.error('Delete past question error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to delete past question.',
    });
  }
}

module.exports = {
  getQuestions,
  getQuestion,
  getAdminQuestions,
  createQuestion,
  updateQuestion,
  checkAnswer,
  deleteQuestion,
};
