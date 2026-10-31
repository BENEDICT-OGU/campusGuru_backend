
const mongoose = require('mongoose');
const StudyMaterial = require('../models/StudyMaterial');
const Course = require('../models/Course');

const allowedTypes = [
  'lecture-note',
  'pdf',
  'slides',
  'summary',
  'video',
  'external-link',
];

function validResourceUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) {
    return false;
  }

  try {
    const url = new URL(value);

    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

function materialResponse(material) {
  return {
    id: material._id,
    course: material.course,
    title: material.title,
    description: material.description,
    type: material.type,
    resourceUrl: material.resourceUrl,
    fileName: material.fileName,
    fileSize: material.fileSize,
    isPublished: material.isPublished,
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
  };
}

// GET /api/study-materials
async function getMaterials(req, res) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);

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

    if (req.query.type !== undefined) {
      if (!allowedTypes.includes(req.query.type)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid study material type.',
        });
      }

      filter.type = req.query.type;
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
          { title: { $regex: escaped, $options: 'i' } },
          { description: { $regex: escaped, $options: 'i' } },
        ];
      }
    }

    // Only materials belonging to published courses are visible.
    const publishedCourses = await Course.find({
      isPublished: true,
    }).distinct('_id');

    filter.course = filter.course
      ? { $in: publishedCourses.filter(
          (id) => id.toString() === filter.course.toString()
        ) }
      : { $in: publishedCourses };

    const skip = (page - 1) * limit;

    const [materials, total] = await Promise.all([
      StudyMaterial.find(filter)
        .populate('course', 'title courseCode level semester')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      StudyMaterial.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      materials,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get study materials error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve study materials.',
    });
  }
}

// GET /api/study-materials/:id
async function getMaterial(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid material ID.',
      });
    }

    const publishedCourses = await Course.find({
      isPublished: true,
    }).distinct('_id');

    const material = await StudyMaterial.findOne({
      _id: req.params.id,
      isPublished: true,
      course: { $in: publishedCourses },
    })
      .populate('course', 'title courseCode level semester')
      .lean();

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Study material not found.',
      });
    }

    return res.status(200).json({
      success: true,
      material,
    });
  } catch (error) {
    console.error('Get study material error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve this study material.',
    });
  }
}

// POST /api/study-materials
async function createMaterial(req, res) {
  try {
    const {
      course,
      title,
      description,
      type,
      resourceUrl,
      fileName,
      fileSize,
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
        message: 'Publish the course before publishing its materials.',
      });
    }

    if (!validResourceUrl(resourceUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Resource URL must be a valid HTTP or HTTPS URL.',
      });
    }

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Select a valid study material type.',
      });
    }

    if (
      fileSize !== undefined &&
      (!Number.isSafeInteger(fileSize) || fileSize < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: 'File size must be a non-negative whole number.',
      });
    }

    const material = await StudyMaterial.create({
      course,
      title,
      description,
      type,
      resourceUrl,
      fileName,
      fileSize,
      isPublished: isPublished === true,
      uploadedBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: 'Study material created successfully.',
      material: materialResponse(material),
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error('Create study material error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to create study material.',
    });
  }
}

// PATCH /api/study-materials/:id
async function updateMaterial(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid material ID.',
      });
    }

    const allowedFields = [
      'course',
      'title',
      'description',
      'type',
      'resourceUrl',
      'fileName',
      'fileSize',
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

    const material = await StudyMaterial.findById(req.params.id);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Study material not found.',
      });
    }

    const targetCourseId = updates.course || material.course;
    const targetCourse = await Course.findById(targetCourseId);

    if (!targetCourse) {
      return res.status(404).json({
        success: false,
        message: 'The selected course does not exist.',
      });
    }

    if (
      updates.isPublished === true &&
      !targetCourse.isPublished
    ) {
      return res.status(400).json({
        success: false,
        message: 'Publish the course before publishing its materials.',
      });
    }

    if (updates.type !== undefined && !allowedTypes.includes(updates.type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid study material type.',
      });
    }

    if (
      updates.resourceUrl !== undefined &&
      !validResourceUrl(updates.resourceUrl)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Resource URL must be a valid HTTP or HTTPS URL.',
      });
    }

    if (
      updates.fileSize !== undefined &&
      (!Number.isSafeInteger(updates.fileSize) || updates.fileSize < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: 'File size must be a non-negative whole number.',
      });
    }

    Object.assign(material, updates);
    await material.save();

    return res.status(200).json({
      success: true,
      message: 'Study material updated successfully.',
      material: materialResponse(material),
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error('Update study material error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to update study material.',
    });
  }
}

// DELETE /api/study-materials/:id
async function deleteMaterial(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid material ID.',
      });
    }

    const material = await StudyMaterial.findByIdAndDelete(req.params.id);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Study material not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Study material deleted successfully.',
    });
  } catch (error) {
    console.error('Delete study material error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to delete study material.',
    });
  }
}

module.exports = {
  getMaterials,
  getMaterial,
  createMaterial,
  updateMaterial,
  deleteMaterial,
};
