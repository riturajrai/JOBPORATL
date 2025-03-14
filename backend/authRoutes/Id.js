const db = require('../Database/database'); // No need for util.promisify()
const authenticateToken = require('../middleware/authenticateToken');

const getUserId = async (req, res) => {
    const { id } = req.params;

    if (!req.user || !req.user.id) {
        return res.status(401).json({ error: "Unauthorized: Token is missing or invalid" });
    }

    const userId = parseInt(id);
    if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
    }

    if (req.user.id !== userId) {
        return res.status(403).json({ error: "Unauthorized Access" });
    }

    try {
        const [result] = await db.query("SELECT id, name, email, phone, created_at FROM users WHERE id = ?", [userId]);

        if (result.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.status(200).json(result[0]);

    } catch (err) {
        console.error("Database Error:", err);
        return res.status(500).json({ error: "Database error" });
    }
};

module.exports = { getUserId };
