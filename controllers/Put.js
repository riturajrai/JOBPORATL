const express = require("express");
const Router = express.Router();
const db = require("../Database/database"); // MySQL database connection
const authenticateToken = require("../middleware/authenticateToken"); // Middleware to verify JWT
const multer = require("multer"); // For handling file uploads
const path = require("path"); // For handling file paths
const fs = require("fs"); // For file system operations (e.g., creating directories)
const { body, validationResult } = require("express-validator"); // For request body validation

// --- File Upload Setup with Multer ---

// Ensure directories exist for file uploads
const ensureDirectoryExists = (directory) => {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true }); // Creates directory and any missing parents
  }
};

// Configure where and how files are stored
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = file.fieldname === "resume" ? "uploads/resumes" : "uploads/profile_pics";
    ensureDirectoryExists(folder); // Create folder if it doesn’t exist
    cb(null, folder); // Callback to set destination
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName); // Generate unique filename
  },
});

// Filter to accept only specific file types
const fileFilter = (req, file, cb) => {
  const validTypes = {
    resume: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    profile_pic: ["image/jpeg", "image/png", "image/gif"],
  };

  const isValid = file.fieldname === "resume" 
    ? validTypes.resume.includes(file.mimetype) 
    : validTypes.profile_pic.includes(file.mimetype);

  if (isValid) {
    cb(null, true); // Accept file
  } else {
    cb(new Error(`Invalid file type for ${file.fieldname}`), false); // Reject file
  }
};

// Multer instance for file uploads
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB
});

// --- Validation Rules for User Updates ---

const validateUserUpdate = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("phone").trim().notEmpty().withMessage("Phone is required"),
  body("location").trim().notEmpty().withMessage("Location is required"),
];

// --- Helper Function for Error Handling ---

const handleError = (res, error, message = "Server error", status = 500) => {
  console.error(`${message}: ${error.message}`); // Log error for debugging
  res.status(status).json({
    message,
    ...(process.env.NODE_ENV === "development" && { error: error.message }), // Show details in dev mode
  });
};

// --- API Routes ---

//-----------------------------------------------------------------
// Upload Resume for a User
//-----------------------------------------------------------------
Router.put(
  "/users/:id/upload-resume",
  authenticateToken, // Verify user is logged in
  upload.single("resume"), // Handle single resume file upload
  async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (req.user.id !== userId) {
        return res.status(403).json({ message: "Unauthorized" }); // Check if user owns this profile
      }

      if (!req.file) {
        return res.status(400).json({ message: "No resume file uploaded" }); // Ensure file is provided
      }

      const resumePath = `/uploads/resumes/${req.file.filename}`;
      await db.query("UPDATE users SET resume_link = ? WHERE id = ?", [resumePath, userId]);

      const [user] = await db.query(
        "SELECT id AS user_id, name, location, email, phone, linkedin, github, resume_link, profile_pic, role FROM users WHERE id = ?",
        [userId]
      );

      res.json({ message: "Resume uploaded successfully", user: user[0] });
    } catch (error) {
      handleError(res, error, "Failed to upload resume");
    }
  }
);

//-----------------------------------------------------------------
// Update Company Profile
//-----------------------------------------------------------------
Router.put("/companyprofile/:userId", authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    if (req.user.id !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const { company_name, logo, about, industry, headquarters, company_size, founded, website, email, contact_name } = req.body;
    if (!company_name) {
      return res.status(400).json({ message: "Company name is required" });
    }

    const [result] = await db.query(
      `UPDATE company_profiles 
       SET company_name = ?, logo = ?, about = ?, industry = ?, headquarters = ?, 
           company_size = ?, founded = ?, website = ?, email = ?, contact_name = ?
       WHERE id = ?`,
      [company_name, logo || null, about || null, industry || null, headquarters || null, company_size || null, founded || null, website || null, email || null, contact_name || null, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Company profile not found or no changes made" });
    }

    res.json({ message: "Profile updated successfully" });
  } catch (error) {
    handleError(res, error, "Error updating company profile");
  }
});

//-----------------------------------------------------------------
// Update User Profile
//-----------------------------------------------------------------
Router.put(
  "/users/:id",
  authenticateToken,
  upload.fields([{ name: "resume", maxCount: 1 }, { name: "profile_pic", maxCount: 1 }]), // Handle multiple file types
  validateUserUpdate, // Apply validation rules
  async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (req.user.id !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() }); // Return validation errors
      }

      const { name, location, email, phone, linkedin, github } = req.body;
      const resumeFile = req.files && req.files["resume"] ? req.files["resume"][0] : null;
      const profilePicFile = req.files && req.files["profile_pic"] ? req.files["profile_pic"][0] : null;

      const [existingUsers] = await db.query(
        "SELECT name, location, email, phone, linkedin, github, resume_link, profile_pic FROM users WHERE id = ?",
        [userId]
      );
      if (!existingUsers.length) {
        return res.status(404).json({ message: "User not found" });
      }

      const existingUser = existingUsers[0];
      const updatedFields = {
        name: name || existingUser.name,
        location: location || existingUser.location,
        email: email || existingUser.email,
        phone: phone || existingUser.phone,
        linkedin: linkedin || existingUser.linkedin || null,
        github: github || existingUser.github || null,
        resume_link: resumeFile ? `/uploads/resumes/${resumeFile.filename}` : existingUser.resume_link,
        profile_pic: profilePicFile ? `/uploads/profile_pics/${profilePicFile.filename}` : existingUser.profile_pic,
      };

      await db.query(
        `UPDATE users 
         SET name = ?, location = ?, email = ?, phone = ?, linkedin = ?, github = ?, 
             resume_link = ?, profile_pic = ?
         WHERE id = ?`,
        [
          updatedFields.name, updatedFields.location, updatedFields.email, updatedFields.phone,
          updatedFields.linkedin, updatedFields.github, updatedFields.resume_link, updatedFields.profile_pic,
          userId,
        ]
      );

      const [updatedUsers] = await db.query(
        "SELECT id AS user_id, name, location, email, phone, linkedin, github, resume_link, profile_pic, role FROM users WHERE id = ?",
        [userId]
      );

      res.json({ message: "Profile updated successfully", user: updatedUsers[0] });
    } catch (error) {
      handleError(res, error, "Failed to update profile");
    }
  }
);

//-----------------------------------------------------------------
// Update Job Application Status
//-----------------------------------------------------------------
Router.put("/applications/status/:applicationId", authenticateToken, async (req, res) => {
  try {
    const applicationId = parseInt(req.params.applicationId);
    const { status } = req.body;

    if (isNaN(applicationId)) {
      return res.status(400).json({ message: "Invalid application ID" });
    }

    const validStatuses = ["Pending", "Applied", "Shortlisted", "Rejected", "Hired", "Reviewed"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    }

    const [result] = await db.execute(
      "UPDATE job_applications SET status = ? WHERE id = ?",
      [status, applicationId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Application not found" });
    }
    const [rows] = await db.execute("SELECT * FROM job_applications WHERE id = ?", [applicationId]);
    res.json({ message: "Application status updated successfully", application: rows[0] });
  } catch (error) {
    handleError(res, error, "Error updating application status");
  }
});

//-----------------------------------------------------------------
// Mark Notification as Read
//-----------------------------------------------------------------
Router.put("/notifications/:id/read", authenticateToken, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(notificationId)) {
      return res.status(400).json({ message: "Invalid notification ID" });
    }

    console.log(`Marking notification ${notificationId} as read for user ${userId}`);
    const [result] = await db.query(
      "UPDATE notifications SET `read` = 1 WHERE id = ? AND user_id = ?",
      [notificationId, userId]
    );

    if (result.affectedRows === 0) {
      console.log(`Notification ${notificationId} not found or not owned by user ${userId}`);
      return res.status(404).json({ message: "Notification not found or not owned by user" });
    }

    res.json({ message: "Notification marked as read" });
  } catch (error) {
    handleError(res, error, "Error marking notification as read");
  }
});

module.exports = Router;