
const StudentProgress = require('../models/StudentProgress');

const getDateKey = (date) => {
  return new Date(date).toISOString().slice(0, 10);
};

const getStudyMinutes = (exam) => {
  const start = new Date(exam.startedAt).getTime();
  const end = new Date(exam.submittedAt || Date.now()).getTime();

  const elapsedMinutes = Math.ceil(
    Math.max(0, end - start) / 60000
  );

  return Math.min(
    elapsedMinutes,
    exam.configuration.durationMinutes
  );
};

const recordExamCompletion = async (exam) => {
  const progress = await StudentProgress.findOneAndUpdate(
    { user: exam.student },
    {
      $setOnInsert: {
        dailyStudyGoalMinutes: 60,
        weeklyStudyGoalMinutes: 600,
        totalStudyMinutes: 0,
        completedTopics: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastStudyDate: null,
        completedExams: 0,
        totalExamScore: 0,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  const today = new Date();
  const todayKey = getDateKey(today);

  const lastStudyKey = progress.lastStudyDate
    ? getDateKey(progress.lastStudyDate)
    : null;

  let currentStreak = progress.currentStreak || 0;

  if (lastStudyKey !== todayKey) {
    if (lastStudyKey) {
      const lastDate = new Date(`${lastStudyKey}T00:00:00.000Z`);
      const todayDate = new Date(`${todayKey}T00:00:00.000Z`);

      const daysDifference = Math.round(
        (todayDate - lastDate) / 86400000
      );

      currentStreak =
        daysDifference === 1 ? currentStreak + 1 : 1;
    } else {
      currentStreak = 1;
    }
  }

  const studyMinutes = getStudyMinutes(exam);

  progress.completedExams += 1;
  progress.totalExamScore += exam.percentage;
  progress.totalStudyMinutes += studyMinutes;

  progress.currentStreak = currentStreak;
  progress.longestStreak = Math.max(
    progress.longestStreak || 0,
    currentStreak
  );

  progress.lastStudyDate = today;

  await progress.save();

  return progress;
};

module.exports = { recordExamCompletion };
