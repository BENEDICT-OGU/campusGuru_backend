
const mongoose = require('mongoose');

const ExamAttempt = require('../models/ExamAttempt');
const PastQuestion = require('../models/PastQuestion');
const Course = require('../models/Course');
const StudentProgress = require('../models/StudentProgress');

const VALID_MODES = [
  'practice',
  'mock',
  'past-questions',
  'quiz',
  'full-exam',
];

const VALID_DIFFICULTIES = ['easy', 'medium', 'hard', 'mixed'];

const VALID_QUESTION_TYPES = [
  'mcq',
  'true-false',
  'fill-blank',
];

const normalizeAnswer = (answer) =>
  String(answer || '').trim().toLowerCase().replace(/\s+/g, ' ');

const isValidObjectId = (id) =>
  mongoose.Types.ObjectId.isValid(id);

const getSafeExam = (exam) => ({
  id: exam._id,
  mode: exam.mode,
  configuration: exam.configuration,
  status: exam.status,
  startedAt: exam.startedAt,
  expiresAt: exam.expiresAt,
  submittedAt: exam.submittedAt,
  questions: exam.questions.map((question) => ({
    questionNumber: question.questionNumber,
    questionText: question.questionText,
    questionType: question.questionType,
    options: question.options,
    selectedAnswer: question.selectedAnswer,
    marks: question.marks,
  })),
});

const getExamResult = (exam) => ({
  id: exam._id,
  mode: exam.mode,
  status: exam.status,
  startedAt: exam.startedAt,
  submittedAt: exam.submittedAt,
  totalMarks: exam.totalMarks,
  score: exam.score,
  percentage: exam.percentage,
  correctCount: exam.correctCount,
  wrongCount: exam.wrongCount,
  unansweredCount: exam.unansweredCount,
  questions: exam.questions.map((question) => ({
    questionNumber: question.questionNumber,
    questionText: question.questionText,
    questionType: question.questionType,
    options: question.options,
    selectedAnswer: question.selectedAnswer,
    correctAnswer: question.correctAnswer,
    acceptedAnswers: question.acceptedAnswers,
    explanation: question.explanation,
    isCorrect: question.isCorrect,
    marks: question.marks,
    negativeMarks: question.negativeMarks,
    marksAwarded: question.marksAwarded,
  })),
});

const gradeExam = (exam) => {
  let totalMarks = 0;
  let score = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;

  exam.questions.forEach((question) => {
    const marks = Number(question.marks) || 0;
    totalMarks += marks;

    const selected = normalizeAnswer(question.selectedAnswer);

    if (!selected) {
      question.isCorrect = false;
      question.marksAwarded = 0;
      unansweredCount += 1;
      return;
    }

    let isCorrect = false;

    if (question.questionType === 'fill-blank') {
      const accepted = [
        question.correctAnswer,
        ...(question.acceptedAnswers || []),
      ].map(normalizeAnswer);

      isCorrect = accepted.includes(selected);
    } else {
      isCorrect =
        selected === normalizeAnswer(question.correctAnswer);
    }

    question.isCorrect = isCorrect;

    if (isCorrect) {
      question.marksAwarded = marks;
      score += marks;
      correctCount += 1;
    } else {
      const penalty = exam.configuration.negativeMarking
        ? Number(question.negativeMarks) || 0
        : 0;

      question.marksAwarded = -penalty;
      score -= penalty;
      wrongCount += 1;
    }
  });

  // The final score cannot fall below zero.
  score = Math.max(0, score);

  exam.totalMarks = totalMarks;
  exam.score = score;
  exam.percentage =
    totalMarks > 0
      ? Math.min(100, Number(((score / totalMarks) * 100).toFixed(2)))
      : 0;

  exam.correctCount = correctCount;
  exam.wrongCount = wrongCount;
  exam.unansweredCount = unansweredCount;
};

const findOwnedExam = async (examId, userId) => {
  if (!isValidObjectId(examId)) {
    return null;
  }

  return ExamAttempt.findOne({
    _id: examId,
    student: userId,
  });
};
// RECORD COMPLETED EXAM IN STUDENT PROGRESS
const recordExamProgress = async (exam) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // Atomically ensure this exam is counted only once.
      const recordedExam = await ExamAttempt.findOneAndUpdate(
        {
          _id: exam._id,
          student: exam.student,
          progressRecorded: false,
        },
        {
          $set: { progressRecorded: true },
        },
        {
          new: true,
          session,
        }
      );

      if (!recordedExam) {
        return;
      }

      await StudentProgress.findOneAndUpdate(
        { user: exam.student },
        {
          $inc: {
            completedExams: 1,
            totalExamScore: exam.percentage,
          },
          $setOnInsert: {
            user: exam.student,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
          session,
        }
      );
    });
  } finally {
    await session.endSession();
  }
};
// START EXAM
exports.startExam = async (req, res) => {
  try {
    const {
      mode,
      courseIds,
      topics = [],
      questionCount,
      durationMinutes,
      difficulty = 'mixed',
      questionTypes = ['mcq'],
      negativeMarking = false,
      shuffleQuestions = true,
    } = req.body;

    if (!VALID_MODES.includes(mode)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid exam mode.',
      });
    }

    if (
      !Array.isArray(courseIds) ||
      courseIds.length === 0 ||
      courseIds.some((id) => !isValidObjectId(id))
    ) {
      return res.status(400).json({
        success: false,
        message: 'Select at least one valid course.',
      });
    }

    if (
      !Number.isInteger(Number(questionCount)) ||
      Number(questionCount) < 1 ||
      Number(questionCount) > 100
    ) {
      return res.status(400).json({
        success: false,
        message: 'Question count must be between 1 and 100.',
      });
    }

    if (
      !Number.isInteger(Number(durationMinutes)) ||
      Number(durationMinutes) < 1 ||
      Number(durationMinutes) > 180
    ) {
      return res.status(400).json({
        success: false,
        message: 'Duration must be between 1 and 180 minutes.',
      });
    }

    if (!VALID_DIFFICULTIES.includes(difficulty)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid difficulty selection.',
      });
    }

    if (
      !Array.isArray(questionTypes) ||
      questionTypes.length === 0 ||
      questionTypes.some((type) => !VALID_QUESTION_TYPES.includes(type))
    ) {
      return res.status(400).json({
        success: false,
        message: 'Select valid question types.',
      });
    }

    if (
      !Array.isArray(topics) ||
      topics.some(
        (topic) =>
          typeof topic !== 'string' ||
          topic.trim().length === 0 ||
          topic.length > 100
      )
    ) {
      return res.status(400).json({
        success: false,
        message: 'Topics must be a list of valid topic names.',
      });
    }

    if (
      typeof negativeMarking !== 'boolean' ||
      typeof shuffleQuestions !== 'boolean'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Exam settings must use valid boolean values.',
      });
    }

    const uniqueCourseIds = [
      ...new Set(courseIds.map((id) => String(id))),
    ];

    const courses = await Course.find({
      _id: { $in: uniqueCourseIds },
      isPublished: true,
    }).select('_id');

    if (courses.length !== uniqueCourseIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more selected courses are unavailable.',
      });
    }

    const questionFilter = {
      course: { $in: courses.map((course) => course._id) },
      isPublished: true,
      questionType: { $in: questionTypes },
    };

    if (topics.length > 0) {
      questionFilter.topic = {
        $in: topics.map((topic) => topic.trim()),
      };
    }

    if (difficulty !== 'mixed') {
      questionFilter.difficulty = difficulty;
    }

    const selectedQuestions = await PastQuestion.aggregate([
      { $match: questionFilter },
      { $sample: { size: Number(questionCount) } },
    ]);

    if (selectedQuestions.length < Number(questionCount)) {
      return res.status(400).json({
        success: false,
        message: `Only ${selectedQuestions.length} matching questions are available. Please choose a smaller question count or change your filters.`,
        availableQuestions: selectedQuestions.length,
      });
    }

    let questions = selectedQuestions;

    if (shuffleQuestions) {
      questions = [...questions].sort(() => Math.random() - 0.5);
    }

    const now = new Date();

    const snapshots = questions.map((question, index) => ({
      originalQuestion: question._id,
      questionText: question.questionText,
      questionType: question.questionType,
      options: question.options || [],
      correctAnswer: question.correctAnswer,
      acceptedAnswers: question.acceptedAnswers || [],
      explanation: question.explanation || '',
      selectedAnswer: '',
      isCorrect: null,
      marks: question.marks || 1,
      negativeMarks: negativeMarking
        ? question.negativeMarks || 0
        : 0,
      marksAwarded: 0,
      questionNumber: index + 1,
    }));

    const exam = await ExamAttempt.create({
      student: req.user._id,
      mode,
      configuration: {
        courseIds: courses.map((course) => course._id),
        topics: topics.map((topic) => topic.trim()),
        questionCount: Number(questionCount),
        durationMinutes: Number(durationMinutes),
        difficulty,
        questionTypes,
        negativeMarking,
        shuffleQuestions,
      },
      questions: snapshots,
      status: 'in-progress',
      startedAt: now,
      expiresAt: new Date(
        now.getTime() + Number(durationMinutes) * 60 * 1000
      ),
    });

    const remainingSeconds = Math.max(
      0,
      Math.ceil((exam.expiresAt.getTime() - Date.now()) / 1000)
    );

    return res.status(201).json({
      success: true,
      message: 'Your examination has started.',
      exam: getSafeExam(exam),
      remainingSeconds,
    });
  } catch (error) {
    console.error('Start exam error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to start examination.',
    });
  }
};

// GET EXAM
exports.getExam = async (req, res) => {
  try {
    const exam = await findOwnedExam(req.params.id, req.user._id);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Examination not found.',
      });
    }

    if (
      exam.status === 'in-progress' &&
      Date.now() >= exam.expiresAt.getTime()
    ) {
     gradeExam(exam);
exam.status = 'expired';
exam.submittedAt = new Date();

await exam.save();
await recordExamProgress(exam);
    }

    if (exam.status !== 'in-progress') {
      return res.json({
        success: true,
        message: 'Examination has ended.',
        result: getExamResult(exam),
      });
    }

    const remainingSeconds = Math.max(
      0,
      Math.ceil((exam.expiresAt.getTime() - Date.now()) / 1000)
    );

    return res.json({
      success: true,
      exam: getSafeExam(exam),
      remainingSeconds,
    });
  } catch (error) {
    console.error('Get exam error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve examination.',
    });
  }
};

// SAVE ANSWER
exports.saveAnswer = async (req, res) => {
  try {
    const { questionNumber, answer } = req.body;

    if (
      !Number.isInteger(Number(questionNumber)) ||
      Number(questionNumber) < 1 ||
      typeof answer !== 'string' ||
      answer.length > 1000
    ) {
      return res.status(400).json({
        success: false,
        message: 'Provide a valid question number and answer.',
      });
    }

    const exam = await findOwnedExam(req.params.id, req.user._id);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Examination not found.',
      });
    }

    if (exam.status !== 'in-progress') {
      return res.status(400).json({
        success: false,
        message: 'This examination is no longer active.',
      });
    }

    if (Date.now() >= exam.expiresAt.getTime()) {
      gradeExam(exam);
exam.status = 'expired';
exam.submittedAt = new Date();

await exam.save();
await recordExamProgress(exam);

      return res.status(400).json({
        success: false,
        message: 'Your examination time has expired.',
        result: getExamResult(exam),
      });
    }

    const question = exam.questions.find(
      (item) => item.questionNumber === Number(questionNumber)
    );

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found in this examination.',
      });
    }

    question.selectedAnswer = answer.trim();
    await exam.save();

    return res.json({
      success: true,
      message: 'Answer saved successfully.',
      questionNumber: question.questionNumber,
    });
  } catch (error) {
    console.error('Save answer error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to save your answer.',
    });
  }
};

// SUBMIT EXAM
exports.submitExam = async (req, res) => {
  try {
    const exam = await findOwnedExam(req.params.id, req.user._id);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Examination not found.',
      });
    }

    if (exam.status !== 'in-progress') {
      return res.status(400).json({
        success: false,
        message: 'This examination has already ended.',
        result: getExamResult(exam),
      });
    }

    const expired = Date.now() >= exam.expiresAt.getTime();

    gradeExam(exam);
    exam.status = expired ? 'expired' : 'submitted';
    exam.submittedAt = new Date();

    await exam.save();
    await recordExamProgress(exam);

    return res.json({
      success: true,
      message: expired
        ? 'Time expired. Your examination was automatically submitted.'
        : 'Examination submitted successfully.',
      result: getExamResult(exam),
    });
  } catch (error) {
    console.error('Submit exam error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to submit examination.',
    });
  }
};

// EXAM HISTORY
exports.getExamHistory = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const filter = {
      student: req.user._id,
      status: { $in: ['submitted', 'expired'] },
    };

    const [exams, total] = await Promise.all([
      ExamAttempt.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          'mode configuration status startedAt submittedAt totalMarks score percentage correctCount wrongCount unansweredCount createdAt'
        ),
      ExamAttempt.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      exams,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Exam history error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve examination history.',
    });
  }
};

// EXAM ANALYTICS
exports.getExamAnalytics = async (req, res) => {
  try {
    const exams = await ExamAttempt.find({
      student: req.user._id,
      status: { $in: ['submitted', 'expired'] },
    })
      .select(
        'mode percentage score totalMarks correctCount wrongCount unansweredCount startedAt submittedAt createdAt'
      )
      .sort({ createdAt: -1 })
      .lean();

    const totalExams = exams.length;

    const totalCorrect = exams.reduce(
      (sum, exam) => sum + exam.correctCount,
      0
    );

    const totalWrong = exams.reduce(
      (sum, exam) => sum + exam.wrongCount,
      0
    );

    const totalUnanswered = exams.reduce(
      (sum, exam) => sum + exam.unansweredCount,
      0
    );

    const totalAttempted = totalCorrect + totalWrong;

    const averagePercentage =
      totalExams > 0
        ? Number(
            (
              exams.reduce((sum, exam) => sum + exam.percentage, 0) /
              totalExams
            ).toFixed(2)
          )
        : 0;

    const accuracy =
      totalAttempted > 0
        ? Number(((totalCorrect / totalAttempted) * 100).toFixed(2))
        : 0;

    // Group results by examination mode.
    const modeStatistics = {};

    exams.forEach((exam) => {
      if (!modeStatistics[exam.mode]) {
        modeStatistics[exam.mode] = {
          mode: exam.mode,
          examsCompleted: 0,
          totalPercentage: 0,
          averagePercentage: 0,
        };
      }

      modeStatistics[exam.mode].examsCompleted += 1;
      modeStatistics[exam.mode].totalPercentage += exam.percentage;
    });

    const performanceByMode = Object.values(modeStatistics).map(
      (item) => ({
        mode: item.mode,
        examsCompleted: item.examsCompleted,
        averagePercentage: Number(
          (
            item.totalPercentage / item.examsCompleted
          ).toFixed(2)
        ),
      })
    );

    // Recent five examinations, oldest first for chart display.
    const recentExams = exams.slice(0, 5).reverse().map((exam) => ({
      id: exam._id,
      mode: exam.mode,
      percentage: exam.percentage,
      score: exam.score,
      totalMarks: exam.totalMarks,
      correctCount: exam.correctCount,
      wrongCount: exam.wrongCount,
      unansweredCount: exam.unansweredCount,
      completedAt: exam.submittedAt || exam.createdAt,
    }));

    const bestExam =
      exams.length > 0
        ? exams.reduce((best, current) =>
            current.percentage > best.percentage ? current : best
          )
        : null;

    return res.json({
      success: true,
      analytics: {
        totalExams,
        averagePercentage,
        accuracy,
        totalCorrect,
        totalWrong,
        totalUnanswered,
        totalAttempted,
        performanceByMode,
        recentExams,
        bestExam: bestExam
          ? {
              examId: bestExam._id,
              mode: bestExam.mode,
              percentage: bestExam.percentage,
              score: bestExam.score,
              totalMarks: bestExam.totalMarks,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Exam analytics error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve examination analytics.',
    });
  }
};

