
const express = require('express');

const {
  getDashboard,
  updateGoals,
} = require('../controllers/dashboardController');

const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Every dashboard endpoint requires a valid login.
router.use(protect);

router.get('/', getDashboard);
router.patch('/goals', updateGoals);

module.exports = router;
