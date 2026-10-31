
const express = require('express');

const {
  getProfile,
  updateProfile,
  changePassword,
} = require('../controllers/profileController');

const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// All profile routes require authentication.
router.use(protect);

router.get('/', getProfile);
router.patch('/', updateProfile);
router.patch('/change-password', changePassword);

module.exports = router;
