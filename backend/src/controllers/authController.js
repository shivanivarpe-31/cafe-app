const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../prisma');

const SALT_ROUNDS = 12;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '8h'; // Default: 8 hours (one shift)

// Login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(403).json({ error: 'Account is deactivated. Please contact an administrator.' });
        }

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: JWT_EXPIRY }
        );

        res.json({
            token,
            expiresIn: JWT_EXPIRY,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                isActive: user.isActive
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Register — FIRST USER ONLY (initial setup)
// This endpoint only works when no users exist in the database.
// After the first admin is created, use POST /api/users (authenticated) to add more users.
exports.register = async (req, res) => {
    try {
        // Check if any users already exist
        const userCount = await prisma.user.count();
        if (userCount > 0) {
            return res.status(403).json({
                error: 'Registration disabled',
                message: 'An admin account already exists. New users must be created by an existing admin via the User Management panel.'
            });
        }

        const { email, password, name } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Validate password strength
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name: name || null,
                role: 'ADMIN' // First user is always ADMIN
            }
        });

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: JWT_EXPIRY }
        );

        res.status(201).json({
            token,
            expiresIn: JWT_EXPIRY,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                isActive: user.isActive
            }
        });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'A user with this email already exists' });
        }
        res.status(500).json({ error: 'Server error during registration' });
    }
};
