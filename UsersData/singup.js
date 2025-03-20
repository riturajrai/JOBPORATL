const db = require("../Database/database");
const bcrypt = require("bcryptjs");

const signupUser = async (req, res) => {
  const { name, email, phone, location, password } = req.body;

  if (!name || !email || !phone || !location || !password) {
    return res.status(400).json({ error: "All fields (name, email, phone, location, password) are required" });
  }
  if (!/^[a-zA-Z\s]+$/.test(name)) {
    return res.status(400).json({ error: "Name must contain only letters and spaces" });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }
  if (!/^\d{10}$/.test(phone)) {
    return res.status(400).json({ error: "Phone must be a 10-digit number" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long" });
  }

  try {
    const checkUserQuery = "SELECT * FROM users WHERE email = ? OR phone = ?";
    const [existingUsers] = await db.query(checkUserQuery, [email, phone]);

    if (existingUsers.length > 0) {
      const existingField = existingUsers[0].email === email ? "email" : "phone";
      return res.status(409).json({ error: `User with this ${existingField} already exists` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertQuery = `
      INSERT INTO users (name, email, phone, location, password, role)
      VALUES (?, ?, ?, ?, ?, 'candidate')
    `;
    const [result] = await db.query(insertQuery, [name, email, phone, location, hashedPassword]);

    res.status(201).json({
      message: "Signup successful",
      userId: result.insertId,
    });
  } catch (err) {
    console.error("Signup Error:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Email or phone already exists" });
    }
    return res.status(500).json({ error: "Database error", details: err.message });
  }
};

module.exports = { signupUser };