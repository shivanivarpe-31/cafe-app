const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../prisma');

const SALT_ROUNDS = 12;

// Login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: { id: user.id, email: user.email, role: user.role }
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Register (seed first owner)
exports.register = async (req, res) => {
    try {
        const { email, password } = req.body;
        const hashedPassword = bcrypt.hashSync(password, SALT_ROUNDS);

        const user = await prisma.user.create({
            data: { email, password: hashedPassword, role: 'owner' }
        });

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            token,
            user: { id: user.id, email: user.email, role: user.role }
        });
    } catch (error) {
        res.status(400).json({ error: 'User exists or invalid data' });
    }
};
