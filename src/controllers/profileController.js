
const User = require('../models/User');

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// GET /api/profile
async function getProfile(req, res) {
  try {
    return res.status(200).json({
      success: true,
      user: publicUser(req.user),
    });
  } catch (error) {
    console.error('Get profile error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve your profile.',
    });
  }
}

// PATCH /api/profile
async function updateProfile(req, res) {
  try {
    const { name, email } = req.body;

    if (name === undefined && email === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Provide a name or email to update.',
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Name must contain at least 2 characters.',
        });
      }

      if (name.trim().length > 80) {
        return res.status(400).json({
          success: false,
          message: 'Name cannot exceed 80 characters.',
        });
      }

      user.name = name.trim();
    }

    if (email !== undefined) {
      if (typeof email !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email address.',
        });
      }

      const cleanEmail = email.trim().toLowerCase();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email address.',
        });
      }

      if (cleanEmail.length > 254) {
        return res.status(400).json({
          success: false,
          message: 'Email address is too long.',
        });
      }

      user.email = cleanEmail;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: publicUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This email address is already in use.',
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error('Update profile error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to update your profile.',
    });
  }
}

// PATCH /api/profile/change-password
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (
      typeof currentPassword !== 'string' ||
      typeof newPassword !== 'string' ||
      !currentPassword ||
      !newPassword
    ) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required.',
      });
    }

    if (newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({
        success: false,
        message: 'New password must contain 8 to 128 characters.',
      });
    }

    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    const isCurrentPasswordCorrect =
      await user.comparePassword(currentPassword);

    if (!isCurrentPasswordCorrect) {
      return res.status(400).json({
        success: false,
        message: 'Your current password is incorrect.',
      });
    }

    const isSamePassword = await user.comparePassword(newPassword);

    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'Your new password must be different.',
      });
    }

    user.password = newPassword;

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please log in again.',
    });
  } catch (error) {
    console.error('Change password error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to change your password right now.',
    });
  }
}

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
};
