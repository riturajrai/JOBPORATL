const db = require("../Database/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const secretKey = process.env.JWT_SECRET || "default_secret_key";

// Employer Signup
const employerSignup = async (req, res) => {
  const { name, email, phone, password, companyName, industry, companySize } = req.body;

  // Validation
  if (!name || !email || !phone || !password || !companyName || !industry || !companySize) {
    return res.status(400).json({
      error: "All fields are required: name, email, phone, password, companyName, industry, companySize",
    });
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

  if (companyName.length < 2) {
    return res.status(400).json({ error: "Company name must be at least 2 characters long" });
  }

  try {
    // Check for existing email or phone
    const checkQuery = "SELECT * FROM users WHERE email = ? OR phone = ?";
    const [existingUser] = await db.query(checkQuery, [email, phone]);
    if (existingUser.length > 0) {
      const existingField = existingUser[0].email === email ? "email" : "phone";
      return res.status(409).json({
        error: `${
          existingField.charAt(0).toUpperCase() + existingField.slice(1)
        } already exists`,
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);

    // Insert into users table
    const sql = `
      INSERT INTO users (name, email, phone, password, role, company_name, industry, company_size, created_at) 
      VALUES (?, ?, ?, ?, 'employer', ?, ?, ?, NOW())
    `;
    const values = [name, email, phone, hashPassword, companyName, industry, companySize];
    const [result] = await db.query(sql, values);

    // Respond with success (no token since no auto-login)
    res.status(201).json({ message: "Employer registered successfully" });
  } catch (error) {
    console.error("Signup error:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Email or phone already exists" });
    }
    res.status(500).json({ error: "Server error during signup", details: error.message });
  }
};

// Employer Login
const employerLogin = async (req, res) => {
  const { identifier, password } = req.body;

  // Validation
  if (!identifier || !password) {
    return res.status(400).json({ error: "Please provide both identifier (email/phone) and password" });
  }

  try {
    // Fetch user by email or phone, restricted to employers
    const sql = `
      SELECT id, name, email, phone, password, role, company_name, industry, company_size 
      FROM users 
      WHERE (email = ? OR phone = ?) AND role = 'employer'
    `;
    const [users] = await db.query(sql, [identifier, identifier]);

    if (users.length === 0) {
      return res.status(401).json({ error: "No employer account found with this email or phone" });
    }

    const user = users[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    // Generate JWT
    const employertoken = jwt.sign(
      { id: user.id, email: user.email, phone: user.phone, role: user.role },
      secretKey,
      { expiresIn: "7d" }
    );

    // Successful login response
    res.status(200).json({
      message: "Login successful",
      employertoken,
      user_id: user.id,
      employer: {
        role: user.role,
        name: user.name,
        email: user.email,
        phone: user.phone,
        company_name: user.company_name,
        industry: user.industry,
        company_size: user.company_size,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error during login", details: error.message });
  }
};

// Get All Employers
const getAllEmployers = async (req, res) => {
  try {
    const [employers] = await db.query(`
      SELECT id, name, email, phone, company_name, industry, company_size, created_at 
      FROM users 
      WHERE role = 'employer'
    `);

    res.status(200).json(employers);
  } catch (error) {
    console.error("Error fetching employers:", error);
    res.status(500).json({ error: "Failed to fetch employers", details: error.message });
  }
};

module.exports = { employerSignup, employerLogin, getAllEmployers };