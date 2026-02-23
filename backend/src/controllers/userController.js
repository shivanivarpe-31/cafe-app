const { prisma } = require('../prisma');
const bcrypt = require('bcryptjs');
const { getPaginationParams, formatPaginatedResponse } = require('../utils/pagination');

const SALT_ROUNDS = 12;

/**
 * Get all users
 */
const getAllUsers = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);

    const where = {};
    if (req.query.role) where.role = req.query.role.toUpperCase();
    if (req.query.isActive !== undefined) where.isActive = req.query.isActive === 'true';

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json(formatPaginatedResponse(users, total, page, limit));
  } catch (error) {
    next(error);
  }
};

/**
 * Get single user by ID
 */
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
};

/**
 * Create new user
 */
const createUser = async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body;
    const creatorId = req.user.id;
    const creatorRole = req.user.role;

    // Validation
    if (!email || !password || !role) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Email, password, and role are required',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
      });
    }

    // Validate password strength (minimum 8 characters)
    if (password.length < 8) {
      return res.status(400).json({
        error: 'Weak password',
        message: 'Password must be at least 8 characters long',
      });
    }

    // Validate role
    const validRoles = ['ADMIN', 'MANAGER', 'CHEF'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: 'Invalid role',
        message: `Role must be one of: ${validRoles.join(', ')}`,
      });
    }

    // Authorization: Managers cannot create Admins
    if (creatorRole === 'MANAGER' && role === 'ADMIN') {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Managers cannot create Admin users',
      });
    }

    // Check if user with email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'A user with this email already exists',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
        role,
        createdBy: creatorId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      message: 'User created successfully',
      user: newUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user
 */
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email, name, role } = req.body;
    const currentUserId = req.user.id;
    const currentUserRole = req.user.role;

    const userId = parseInt(id);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Cannot modify yourself
    if (userId === currentUserId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You cannot modify your own account. Please ask another admin.',
      });
    }

    // Validate role if provided
    if (role) {
      const validRoles = ['ADMIN', 'MANAGER', 'CHEF'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          error: 'Invalid role',
          message: `Role must be one of: ${validRoles.join(', ')}`,
        });
      }

      // Managers cannot promote users to Admin
      if (currentUserRole === 'MANAGER' && role === 'ADMIN') {
        return res.status(403).json({
          error: 'Permission denied',
          message: 'Managers cannot promote users to Admin role',
        });
      }

      // Managers cannot modify Admin users
      if (currentUserRole === 'MANAGER' && existingUser.role === 'ADMIN') {
        return res.status(403).json({
          error: 'Permission denied',
          message: 'Managers cannot modify Admin users',
        });
      }
    }

    // Validate email if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          error: 'Invalid email format',
        });
      }

      // Check if email is already taken by another user
      if (email !== existingUser.email) {
        const emailTaken = await prisma.user.findUnique({
          where: { email },
        });

        if (emailTaken) {
          return res.status(409).json({
            error: 'Email already in use',
            message: 'This email is already registered to another user',
          });
        }
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(email && { email }),
        ...(name !== undefined && { name }),
        ...(role && { role }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    res.json({
      message: 'User updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user
 */
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;
    const currentUserRole = req.user.role;

    const userId = parseInt(id);

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Cannot delete yourself
    if (userId === currentUserId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You cannot delete your own account',
      });
    }

    // Only Admins can delete users
    if (currentUserRole !== 'ADMIN') {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Only Admins can delete users',
      });
    }

    // Check if this is the last admin
    if (user.role === 'ADMIN') {
      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN', isActive: true },
      });

      if (adminCount <= 1) {
        return res.status(403).json({
          error: 'Cannot delete last admin',
          message: 'At least one admin must exist in the system',
        });
      }
    }

    // Delete user
    await prisma.user.delete({
      where: { id: userId },
    });

    res.json({
      message: 'User deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deactivate user
 */
const deactivateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;
    const currentUserRole = req.user.role;

    const userId = parseInt(id);

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Cannot deactivate yourself
    if (userId === currentUserId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You cannot deactivate your own account',
      });
    }

    // Only Admins can deactivate users
    if (currentUserRole !== 'ADMIN') {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Only Admins can deactivate users',
      });
    }

    // Check if this is the last active admin
    if (user.role === 'ADMIN' && user.isActive) {
      const activeAdminCount = await prisma.user.count({
        where: { role: 'ADMIN', isActive: true },
      });

      if (activeAdminCount <= 1) {
        return res.status(403).json({
          error: 'Cannot deactivate last admin',
          message: 'At least one active admin must exist in the system',
        });
      }
    }

    // Deactivate user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    res.json({
      message: 'User deactivated successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Activate user
 */
const activateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUserRole = req.user.role;

    const userId = parseInt(id);

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only Admins can activate users
    if (currentUserRole !== 'ADMIN') {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Only Admins can activate users',
      });
    }

    // Activate user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    res.json({
      message: 'User activated successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  deactivateUser,
  activateUser,
};
