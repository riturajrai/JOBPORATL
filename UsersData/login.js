const db = require("../Database/database");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
require("dotenv").config(); // Ensure environment variables are loaded

const secretKey = process.env.JWT_SECRET || "default_secret_key"; // Fallback if not set in .env

const login = async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: "Please provide both identifier (email/phone) and password" });
  }

  // Basic identifier format check
  const isEmail = /^\S+@\S+\.\S+$/.test(identifier);
  const isPhone = /^\d{10}$/.test(identifier);
  if (!isEmail && !isPhone) {
    return res.status(400).json({ error: "Identifier must be a valid email or 10-digit phone number" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long" });
  }

  try {
    // Fetch candidate by email or phone, restricted to role = 'candidate'
    const query = `
      SELECT id, name, email, phone, password, role, location, linkedin, github, resume_link, profile_pic 
      FROM users 
      WHERE (email = ? OR phone = ?) AND role = 'candidate'
    `;
    const [results] = await db.query(query, [identifier, identifier]);

    if (results.length === 0) {
      return res.status(401).json({ error: "No candidate account found with this email or phone" });
    }
    const user = results[0];
    console.log("Fetched Candidate from DB:", {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    });

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    console.log("Password Match Status:", isMatch);
    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect password" });
    }
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, phone: user.phone, role: user.role },
      secretKey,
      { expiresIn: "1h" } // Keep 1-hour expiration as in your original
    );

    // Response compatible with frontend Profile component
    res.status(200).json({
      message: "Login successful",
      token, // Using "token" key for candidates
      user_id: user.id, // Matches Profile's localStorage.getItem("user_id")
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        location: user.location || "",
        linkedin: user.linkedin || "",
        github: user.github || "",
        resume_link: user.resume_link || "",
        profile_pic: user.profile_pic || "",
      },
    });
  } catch (err) {
    console.error("Candidate Login Error:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
};

module.exports = { login };