const express = require("express");
const router = express.Router();
const db = require("../Database/database"); // MySQL connection
const { signupUser } = require("../UsersData/singup"); // Candidate signup logic
const { login } = require("../UsersData/login"); // Candidate login logic
const { employerSignup, employerLogin } = require("../Empolyers/employerModel"); // Employer auth logic
const authenticateToken = require("../middleware/authenticateToken"); // JWT middleware
const { upload } = require("../middleware/upload"); // File upload middleware
const { body, validationResult } = require("express-validator"); // Request validation
const { createNotification } = require("../utils/notifications");

// --- Utility Functions ---

// Centralized error handler for consistent responses
const handleError = (res, error, message = "Internal server error", status = 500) => {
  console.error(`${message}:`, error.message);
  return res.status(status).json({
    message,
    ...(process.env.NODE_ENV === "development" && { error: error.message }), // Show error details in dev mode
  });
};

const validateNotification = [
  body("message").trim().notEmpty().withMessage("Message is required"),
  body("user_id").isInt().withMessage("User ID must be an integer"),
];

// Validation rules for job posting
const jobValidationRules = [
  body("title").notEmpty().withMessage("Job title is required"),
  body("company").notEmpty().withMessage("Company name is required"),
  body("job_type").notEmpty().withMessage("Job type is required"),
  body("description").notEmpty().withMessage("Description is required"),
];

const validateApply = [
  body("user_id").isInt().withMessage("User ID must be an integer"),
  body("job_id").isInt().withMessage("Job ID must be an integer"),
  body("resume_link").notEmpty().withMessage("Resume link is required"),
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("phone").trim().notEmpty().withMessage("Phone is required"),
  body("email").isEmail().withMessage("Valid email is required"),
];

// --- Authentication Routes ---

//-----------------------------------------------------------------
// Candidate Signup
//-----------------------------------------------------------------
router.post("/signup", signupUser);

//-----------------------------------------------------------------
// Candidate Login
//-----------------------------------------------------------------
router.post("/login", login);

//-----------------------------------------------------------------
// Employer Signup
//-----------------------------------------------------------------
router.post("/employer/signup", employerSignup);

//-----------------------------------------------------------------
// Employer Login
//-----------------------------------------------------------------
router.post("/employer/login", employerLogin);

// --- Job Routes ---

//-----------------------------------------------------------------
// Create a New Job (Employer Only)
//-----------------------------------------------------------------
router.post(
  "/jobs",
  authenticateToken, // Ensure user is authenticated
  upload.single("logo"), // Handle logo upload
  jobValidationRules, // Validate request body
  async (req, res) => {
    try {
      // Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Restrict to employers
      if (req.user.role !== "employer") {
        return res.status(403).json({ message: "Only employers can post jobs" });
      }

      // Extract job details from request body
      const {
        title,
        job_type,
        description,
        salary_min,
        salary_max,
        salary_type,
        company,
        location,
        experience,
        work_location,
        application_deadline,
        skills,
        company_size,
        benefits,
        category,
        requirements,
        apply_url,
      } = req.body;

      const logo = req.file ? `/uploads/${req.file.filename}` : null; // Handle uploaded logo
      const posted_by = req.user.id; // Get employer ID from token

      // Basic validation
      if (!posted_by) {
        return res.status(401).json({ message: "Invalid token: No user ID" });
      }
      if (salary_min && salary_max && Number(salary_min) > Number(salary_max)) {
        return res.status(400).json({ message: "Minimum salary cannot exceed maximum salary" });
      }
      if (application_deadline && new Date(application_deadline) < new Date()) {
        return res.status(400).json({ message: "Application deadline cannot be in the past" });
      }

      // Insert job into database
      const [result] = await db.query(
        `INSERT INTO jobs (
          title, job_type, description, salary_min, salary_max, salary_type,
          company, location, experience, work_location, application_deadline,
          skills, company_size, benefits, category, requirements, apply_url,
          posted_by, logo, date_posted, status, views
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'active', 0)`,
        [
          title,
          job_type,
          description,
          salary_min || null,
          salary_max || null,
          salary_type || "Yearly",
          company,
          location || null,
          experience || null,
          work_location || null,
          application_deadline || null,
          skills ? JSON.stringify(skills.split(",")) : "[]", // Convert skills string to JSON array
          company_size || null,
          benefits || null,
          category || null,
          requirements || null,
          apply_url || null,
          posted_by,
          logo,
        ]
      );

      res.status(201).json({ message: "Job posted successfully", jobId: result.insertId });
    } catch (error) {
      handleError(res, error, "Failed to post job");
    }
  }
);

// --- Job Interaction Routes (Candidates only) ---

//-----------------------------------------------------------------
// Save or Unsave a Job (Candidate Only)
//-----------------------------------------------------------------
router.post("/jobs/:id/save", authenticateToken, async (req, res) => {
  try {
    // Restrict to candidates
    if (req.user.role !== "candidate") {
      return res.status(403).json({ message: "Only candidates can save jobs" });
    }

    const jobId = parseInt(req.params.id);
    const userId = req.user.id;

    // Validate job ID
    if (isNaN(jobId)) {
      return res.status(400).json({ message: "Invalid job ID" });
    }

    // Check if job is already saved
    const [existing] = await db.query(
      "SELECT * FROM saved_jobs WHERE user_id = ? AND job_id = ?",
      [userId, jobId]
    );

    if (existing.length > 0) {
      // Unsave the job
      await db.query("DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?", [userId, jobId]);
      res.json({ message: "Job unsaved" });
    } else {
      // Save the job
      await db.query(
        "INSERT INTO saved_jobs (user_id, job_id, saved_at) VALUES (?, ?, NOW())",
        [userId, jobId]
      );
      res.json({ message: "Job saved" });
    }
  } catch (error) {
    handleError(res, error, "Failed to save job");
  }
});

//-----------------------------------------------------------------
// Apply to a Job (Candidate Only, Simplified)
//-----------------------------------------------------------------
router.post("/jobs/:id/apply", authenticateToken, async (req, res) => {
  try {
    // Restrict to candidates
    if (req.user.role !== "candidate") {
      return res.status(403).json({ message: "Only candidates can apply for jobs" });
    }

    const jobId = parseInt(req.params.id);
    const userId = req.user.id;

    // Validate job ID
    if (isNaN(jobId)) {
      return res.status(400).json({ message: "Invalid job ID" });
    }

    // Check if job exists and is active
    const [job] = await db.query(
      "SELECT title, company, application_deadline FROM jobs WHERE id = ? AND status = 'active'",
      [jobId]
    );
    if (!job.length) {
      return res.status(404).json({ message: "Job not found or not active" });
    }

    // Check application deadline
    if (job[0].application_deadline && new Date(job[0].application_deadline) < new Date()) {
      return res.status(400).json({ message: "Job application deadline has passed" });
    }

    // Check if already applied
    const [existing] = await db.query(
      "SELECT * FROM job_applications WHERE user_id = ? AND job_id = ?",
      [userId, jobId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: "You have already applied to this job" });
    }

    // Submit application
    await db.query(
      "INSERT INTO job_applications (user_id, job_id, applied_at, status) VALUES (?, ?, NOW(), 'Pending')",
      [userId, jobId]
    );

    // Add notification
    await db.query(
      "INSERT INTO notifications (user_id, message, created_at) VALUES (?, ?, NOW())",
      [userId, `You have successfully applied to ${job[0].title} at ${job[0].company}`]
    );

    res.status(201).json({ message: "Application submitted successfully" });
  } catch (error) {
    handleError(res, error, "Failed to apply to job");
  }
});

// --- Messaging Routes ---

//-----------------------------------------------------------------
// Send a Message (Employer to Candidate)
//-----------------------------------------------------------------
router.post("/messages", authenticateToken, async (req, res) => {
  try {
    // Restrict to employers
    if (req.user.role !== "employer") {
      return res.status(403).json({ message: "Only employers can send messages" });
    }

    const { candidateId, message } = req.body;
    const employerId = req.user.id;

    // Validate request body
    if (!candidateId || !message) {
      return res.status(400).json({ message: "Candidate ID and message are required" });
    }

    // Verify candidate exists
    const [candidate] = await db.query(
      "SELECT id FROM users WHERE id = ? AND role = 'candidate'",
      [candidateId]
    );
    if (!candidate.length) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    // Send message
    const [result] = await db.query(
      "INSERT INTO messages (sender_id, receiver_id, content, sent_at) VALUES (?, ?, ?, NOW())",
      [employerId, candidateId, message]
    );

    res.status(201).json({
      message: "Message sent successfully",
      messageId: result.insertId,
    });
  } catch (error) {
    handleError(res, error, "Failed to send message");
  }
});

//-----------------------------------------------------------------
// Apply to a Job (Candidate Only, Detailed)
//-----------------------------------------------------------------
router.post("/apply", authenticateToken, validateApply, async (req, res) => {
  try {
    // Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Restrict to candidates
    if (req.user.role !== "candidate") {
      return res.status(403).json({ message: "Only candidates can apply for jobs" });
    }

    const { user_id, job_id, cover_letter, resume_link, name, phone, email } = req.body;

    // Ensure user_id matches authenticated user
    if (req.user.id !== parseInt(user_id)) {
      return res.status(403).json({ message: "Unauthorized: User ID mismatch" });
    }

    // Check if job exists and is active
    const [job] = await db.query(
      "SELECT title, company, application_deadline, status FROM jobs WHERE id = ?",
      [job_id]
    );
    if (!job.length) {
      return res.status(404).json({ message: "Job not found" });
    }
    if (job[0].status !== "active") {
      return res.status(400).json({ message: "This job is not active" });
    }
    if (job[0].application_deadline && new Date(job[0].application_deadline) < new Date()) {
      return res.status(400).json({ message: "Application deadline has passed" });
    }

    // Check if user has already applied
    const [existingApplication] = await db.query(
      "SELECT id FROM job_applications WHERE user_id = ? AND job_id = ?",
      [user_id, job_id]
    );
    if (existingApplication.length > 0) {
      return res.status(400).json({ message: "You have already applied to this job" });
    }

    // Insert application into job_applications table
    const [applicationResult] = await db.query(
      `INSERT INTO job_applications (user_id, job_id, cover_letter, resume_link, name, phone, email, applied_at, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 'Applied')`,
      [user_id, job_id, cover_letter || null, resume_link, name, phone, email]
    );

    // Insert notification for the candidate
    await db.query(
      `INSERT INTO notifications (user_id, message, created_at) 
       VALUES (?, ?, NOW())`,
      [user_id, `You have successfully applied to ${job[0].title} at ${job[0].company}`]
    );

    // Send notification to the candidate
    await createNotification(
      user_id,
      `You have successfully applied to ${job[0].title} at ${job[0].company}`,
      "success"
    );
    res.status(201).json({ message: "Application submitted successfully", applicationId: applicationResult.insertId });
  } catch (error) {
    handleError(res, error, "Failed to submit application");
  }
});

//-----------------------------------------------------------------
// Create a Notification (Employer or Admin Only)
//-----------------------------------------------------------------
router.post("/notifications", authenticateToken, validateNotification, async (req, res) => {
  try {
    // Only admins or employers might create notifications manually; adjust as needed
    if (req.user.role !== "employer" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only employers or admins can create notifications" });
    }

    const { user_id, message, type } = req.body;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const [result] = await db.query(
      "INSERT INTO notifications (user_id, message, type, created_at) VALUES (?, ?, ?, NOW())",
      [user_id, message, type || "info"]
    );

    res.status(201).json({ message: "Notification created successfully", notificationId: result.insertId });
  } catch (error) {
    handleError(res, error, "Failed to create notification");
  }
});

// -----------------------------------------------------------------
//  Report a Job API
//------------------------------------------------------------------
router.post("/jobs/:id/report",authenticateToken, async (req, res) => {
  console.log("Job Report API hit...");
  const { reason, details } = req.body;
  const job_id = req.params.id;
  const user_id = req.user.id; // Authenticated User ID

  if (!reason || !job_id || !user_id) {
    console.log("Missing required fields");
    return res.status(400).json({ message: "Job ID, User ID, and Reason are required" });
  }

  try {
    console.log(" Inserting Report into Database...");
    const sql = `
      INSERT INTO user_reported_jobs (user_id, job_id, reason, details)
      VALUES (?, ?, ?, ?)
    `;
    await db.execute(sql, [user_id, job_id, reason, details || null]);

    console.log("Report Submitted Successfully");
    res.status(201).json({ message: "Job reported successfully" });
  } catch (error) {
    console.error("Database Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
module.exports = router;
