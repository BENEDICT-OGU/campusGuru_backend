
const StudentProgress = require('../models/StudentProgress');

// GET /api/dashboard
async function getDashboard(req, res) {
  try {
    // Create default progress for a student visiting the dashboard
    // for the first time.
    const progress = await StudentProgress.findOneAndUpdate(
      { user: req.user._id },
      {
        $setOnInsert: {
          user: req.user._id,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    );

    const averageExamScore =
      progress.completedExams > 0
        ? Number(
            (progress.totalExamScore / progress.completedExams).toFixed(2)
          )
        : 0;

    return res.status(200).json({
      success: true,
      dashboard: {
        student: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
        },

        goals: {
          dailyStudyGoalMinutes: progress.dailyStudyGoalMinutes,
          weeklyStudyGoalMinutes: progress.weeklyStudyGoalMinutes,
        },

        studyStats: {
          totalStudyMinutes: progress.totalStudyMinutes,
          totalStudyHours: Number(
            (progress.totalStudyMinutes / 60).toFixed(2)
          ),
          completedTopics: progress.completedTopics,
          currentStreak: progress.currentStreak,
          longestStreak: progress.longestStreak,
          lastStudyDate: progress.lastStudyDate,
        },

        examStats: {
          completedExams: progress.completedExams,
          averageExamScore,
        },

        recentActivity: [],
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to load your dashboard.',
    });
  }
}

// PATCH /api/dashboard/goals
async function updateGoals(req, res) {
  try {
    const {
      dailyStudyGoalMinutes,
      weeklyStudyGoalMinutes,
    } = req.body;

    if (
      dailyStudyGoalMinutes === undefined &&
      weeklyStudyGoalMinutes === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one study goal to update.',
      });
    }

    const progress = await StudentProgress.findOneAndUpdate(
      { user: req.user._id },
      {
        $setOnInsert: {
          user: req.user._id,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    const dailyGoal =
      dailyStudyGoalMinutes === undefined
        ? progress.dailyStudyGoalMinutes
        : dailyStudyGoalMinutes;

    const weeklyGoal =
      weeklyStudyGoalMinutes === undefined
        ? progress.weeklyStudyGoalMinutes
        : weeklyStudyGoalMinutes;

    if (
      typeof dailyGoal !== 'number' ||
      !Number.isInteger(dailyGoal) ||
      dailyGoal < 15 ||
      dailyGoal > 480
    ) {
      return res.status(400).json({
        success: false,
        message: 'Daily goal must be between 15 and 480 minutes.',
      });
    }

    if (
      typeof weeklyGoal !== 'number' ||
      !Number.isInteger(weeklyGoal) ||
      weeklyGoal < 60 ||
      weeklyGoal > 3360
    ) {
      return res.status(400).json({
        success: false,
        message: 'Weekly goal must be between 60 and 3360 minutes.',
      });
    }

    if (weeklyGoal < dailyGoal) {
      return res.status(400).json({
        success: false,
        message: 'Weekly goal cannot be lower than your daily goal.',
      });
    }

    progress.dailyStudyGoalMinutes = dailyGoal;
    progress.weeklyStudyGoalMinutes = weeklyGoal;

    await progress.save();

    return res.status(200).json({
      success: true,
      message: 'Study goals updated successfully.',
      goals: {
        dailyStudyGoalMinutes: progress.dailyStudyGoalMinutes,
        weeklyStudyGoalMinutes: progress.weeklyStudyGoalMinutes,
      },
    });
  } catch (error) {
    console.error('Update goals error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to update your study goals.',
    });
  }
}

module.exports = {
  getDashboard,
  updateGoals,
};
