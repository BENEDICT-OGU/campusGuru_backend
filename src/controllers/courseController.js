
const mongoose = require('mongoose');
const Course = require('../models/Course');

const allowedFields = [
  'title',
  'courseCode',
  'faculty',
  'department',
  'level',
  'semester',
  'description',
  'coverImage',
  'isPublished',
];

function courseResponse(course) {
  return {
    id: course._id,
    title: course.title,
    courseCode: course.courseCode,
    faculty: course.faculty,
    department: course.department,
    level: course.level,
    semester: course.semester,
    description: course.description,
    coverImage: course.coverImage,
    isPublished: course.isPublished,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
}

// GET /api/courses
async function getCourses(req, res) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 20)
    );

    const filter = { isPublished: true };

    if (req.query.level !== undefined) {
      const level = Number(req.query.level);

      if (![100, 200, 300, 400, 500].includes(level)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid academic level.',
        });
      }

      filter.level = level;
    }

    if (req.query.semester !== undefined) {
      const semester = String(req.query.semester).toLowerCase();

      if (!['first', 'second'].includes(semester)) {
        return res.status(400).json({
          success: false,
          message: 'Semester must be first or second.',
        });
      }

      filter.semester = semester;
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
          { courseCode: { $regex: escaped, $options: 'i' } },
          { department: { $regex: escaped, $options: 'i' } },
        ];
      }
    }

    const skip = (page - 1) * limit;

    const [courses, total] = await Promise.all([
      Course.find(filter)
        .sort({ title: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Course.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      courses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get courses error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve courses.',
    });
  }
}

// GET /api/courses/:id
async function getCourse(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid course ID.',
      });
    }

    const course = await Course.findOne({
      _id: req.params.id,
      isPublished: true,
    }).lean();

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found.',
      });
    }

    return res.status(200).json({
      success: true,
      course,
    });
  } catch (error) {
    console.error('Get course error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve this course.',
    });
  }
}

// POST /api/courses
async function createCourse(req, res) {
  try {
    const course = await Course.create({
      title: req.body.title,
      courseCode: req.body.courseCode,
      faculty: req.body.faculty,
      department: req.body.department,
      level: req.body.level,
      semester: req.body.semester,
      description: req.body.description,
      coverImage: req.body.coverImage,
      isPublished: req.body.isPublished === true,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: 'Course created successfully.',
      course: courseResponse(course),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A course with this course code already exists.',
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error('Create course error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to create course.',
    });
  }
}

// PATCH /api/courses/:id
async function updateCourse(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid course ID.',
      });
    }

    const updates = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one valid course field to update.',
      });
    }

    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Course updated successfully.',
      course: courseResponse(course),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A course with this course code already exists.',
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error('Update course error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to update course.',
    });
  }
}

// DELETE /api/courses/:id
async function deleteCourse(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid course ID.',
      });
    }

    const course = await Course.findByIdAndDelete(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Course deleted successfully.',
    });
  } catch (error) {
    console.error('Delete course error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to delete course.',
    });
  }
}

module.exports = {
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
};
