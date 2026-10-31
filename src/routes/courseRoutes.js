
const express = require('express');

const {
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
} = require('../controllers/courseController');

const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');

const router = express.Router();

// Students can browse published courses.
router.get('/', getCourses);
router.get('/:id', getCourse);

// Only authenticated administrators can manage courses.
router.post('/', protect, adminOnly, createCourse);
router.patch('/:id', protect, adminOnly, updateCourse);
router.delete('/:id', protect, adminOnly, deleteCourse);

module.exports = router;
