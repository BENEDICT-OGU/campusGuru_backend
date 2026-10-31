
const express = require('express');

const {
  getMaterials,
  getMaterial,
  createMaterial,
  updateMaterial,
  deleteMaterial,
} = require('../controllers/studyMaterialController');

const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');

const router = express.Router();

// Public browsing of published study materials.
router.get('/', getMaterials);
router.get('/:id', getMaterial);

// Administrator-only management.
router.post('/', protect, adminOnly, createMaterial);
router.patch('/:id', protect, adminOnly, updateMaterial);
router.delete('/:id', protect, adminOnly, deleteMaterial);

module.exports = router;
