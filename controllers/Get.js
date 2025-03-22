const express = require("express");
const router = express.Router();
const db = require("../Database/database"); // Assuming this is your MySQL connection
const authenticateToken = require("../middleware/authenticateToken"); // JWT middleware

// Utility function to safely parse JSON (handles invalid JSON gracefully)
const parseJSON = (data, id, fieldName) => {
  try {
    return JSON.parse(data || "[]"); // Default to empty array if null/undefined
  } catch (error) {
    console.error(`Error parsing ${fieldName} for ID ${id}:`, error.message);
    return []; // Fallback to empty array
  }
};

// Utility function to parse skills (handles strings and JSON)
const parseSkills = (skills) => {
  if (!skills) return []; // Return empty array if null/undefined
  if (Array.isArray(skills)) return skills; // Already an array, no parsing needed
  try {
    const parsed = JSON.parse(skills);
    return Array.isArray(parsed) ? parsed : [parsed]; // Ensure result is an array
  } catch (err) {
    console.warn(`Invalid skills JSON: ${skills}, treating as single skill`);
    return [skills]; // Treat invalid JSON as a single-item array
  }
};

// Consistent error handler
const handleError = (res, error, message = "Server error", status = 500) => {
  console.error(`${message}:`, error.message);
  return res.status(status).json({ error: message });
};

// --- Job Routes ---

//-----------------------------------------------------------------
// Fetch All Active Jobs
//-----------------------------------------------------------------
router.get("/jobs", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM jobs WHERE status = 'active'");
    if (!rows.length) {
      return res.status(404).json({ message: "No active jobs found" });
    }
    // Map jobs and parse skills
    const jobs = rows.map((job) => ({
      ...job,
      skills: parseSkills(job.skills),
    }));
    res.json(jobs);
  } catch (error) {
    handleError(res, error, "Failed to fetch jobs");
  }
});

//-----------------------------------------------------------------
// Fetch a Single Job by ID
//-----------------------------------------------------------------
router.get("/jobs/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query("SELECT * FROM jobs WHERE id = ? AND status = 'active'", [id]);
    if (!rows.length) {
      return res.status(404).json({ message: "Job not found" });
    }

    const job = rows[0];
    job.skills = parseSkills(job.skills); // Parse skills safely
    // Increment views
    await db.query("UPDATE jobs SET views = views + 1 WHERE id = ?", [id]);
    res.json(job);
  } catch (error) {
    handleError(res, error, "Failed to fetch job");
  }
});

//-----------------------------------------------------------------
// Fetch Jobs Posted by a User
//-----------------------------------------------------------------
router.get("/jobs/user/:userId", authenticateToken, async (req, res) => {
  const { userId } = req.params;

  try {
    // Ensure userId matches authenticated user (optional security)
    if (req.user.id !== parseInt(userId)) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    const [rows] = await db.query("SELECT * FROM jobs WHERE posted_by = ?", [userId]);
    if (!rows.length) {
      return res.status(404).json({ message: "No jobs found for this user" });
    }

    const jobs = rows.map((job) => ({
      ...job,
      skills: parseSkills(job.skills),
    }));

    res.json(jobs);
  } catch (error) {
    handleError(res, error, "Failed to fetch user jobs");
  }
});

//-----------------------------------------------------------------
// Check Job Status (Saved, Applied, Reported)
//-----------------------------------------------------------------
router.get("/jobs/:id/status", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const jobId = parseInt(id);
    if (isNaN(jobId)) {
      return res.status(400).json({ message: "Invalid job ID" });
    }

    const [saved] = await db.query(
      "SELECT * FROM saved_jobs WHERE user_id = ? AND job_id = ?",
      [userId, jobId]
    );
    const [applied] = await db.query(
      "SELECT * FROM job_applications WHERE user_id = ? AND job_id = ?",
      [userId, jobId]
    );
    const [reported] = await db.query(
      "SELECT * FROM job_reports WHERE user_id = ? AND job_id = ?",
      [userId, jobId]
    );

    res.json({
      isSaved: saved.length > 0,
      hasApplied: applied.length > 0,
      isReported: reported.length > 0,
    });
  } catch (error) {
    handleError(res, error, "Failed to check job status");
  }
});

// --- User Routes ---

//-----------------------------------------------------------------
// Fetch User Profile
//-----------------------------------------------------------------
router.get("/users/:id", authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (req.user.id !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const [users] = await db.query(
      `SELECT id AS user_id, name, location, email, phone, linkedin, github, resume_link, profile_pic, 
              skills, hobbies, availability, preferred_job_type, role, portfolio, bio 
       FROM users WHERE id = ?`,
      [userId]
    );

    if (!users.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const [education] = await db.query(
      "SELECT title, institution, year FROM user_education WHERE user_id = ?",
      [userId]
    );
    const [experience] = await db.query(
      "SELECT title, institution, year FROM user_experience WHERE user_id = ?",
      [userId]
    );
    const [certifications] = await db.query(
      "SELECT title, institution, year FROM user_certifications WHERE user_id = ?",
      [userId]
    );
    const [languages] = await db.query(
      "SELECT language FROM user_languages WHERE user_id = ?",
      [userId]
    );

    const userData = {
      ...users[0],
      education,
      experience,
      certifications,
      languages: languages.map((lang) => lang.language), // Flatten to array of strings
    };

    res.json(userData);
  } catch (error) {
    handleError(res, error, "Failed to fetch user profile");
  }
});


//-----------------------------------------------------------------
// Fetch Candidate Profile (Simplified)
//-----------------------------------------------------------------
router.get("/userr/:candidateId", authenticateToken, async (req, res) => {
  const { candidateId } = req.params;

  try {
    const id = parseInt(candidateId);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid candidate ID" });
    }

    const [users] = await db.query(
      "SELECT id, name, email, phone, location, profile_pic, resume_link FROM users WHERE id = ?",
      [id]
    );
    if (!users.length) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    res.json(users[0]);
  } catch (error) {
    handleError(res, error, "Failed to fetch candidate profile");
  }
});

//-----------------------------------------------------------------
// Fetch Saved Jobs for a User
//-----------------------------------------------------------------
router.get("/users/:id/saved-jobs", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const userId = parseInt(id);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const [rows] = await db.query(
      "SELECT j.* FROM jobs j JOIN saved_jobs sj ON j.id = sj.job_id WHERE sj.user_id = ?",
      [userId]
    );
    const jobs = rows.map((job) => ({
      ...job,
      skills: parseSkills(job.skills),
    }));

    res.json(jobs);
  } catch (error) {
    handleError(res, error, "Failed to fetch saved jobs");
  }
});

//-----------------------------------------------------------------
// Fetch Applied Jobs for a User
//-----------------------------------------------------------------
router.get("/users/:id/applied-jobs", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const userId = parseInt(id);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const [rows] = await db.query(
      "SELECT j.*, ja.status, ja.applied_at FROM jobs j JOIN job_applications ja ON j.id = ja.job_id WHERE ja.user_id = ?",
      [userId]
    );
    const jobs = rows.map((job) => ({
      ...job,
      skills: parseSkills(job.skills),
    }));

    res.json(jobs);
  } catch (error) {
    handleError(res, error, "Failed to fetch applied jobs");
  }
});

//-----------------------------------------------------------------
// Fetch User Notifications (First Instance)
//-----------------------------------------------------------------
router.get("/users/:userId/notifications", authenticateToken, async (req, res) => {
  const { userId } = req.params;

  try {
    const id = parseInt(userId);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const [notifications] = await db.query(
      "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC",
      [id]
    );

    res.json(notifications);
  } catch (error) {
    handleError(res, error, "Failed to fetch notifications");
  }
});

// --- Application Routes ---

//-----------------------------------------------------------------
// Fetch Applications for a Job
//-----------------------------------------------------------------
router.get("/applications/job/:job_id", authenticateToken, async (req, res) => {
  const { job_id } = req.params;

  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const jobId = parseInt(job_id);
    if (isNaN(jobId)) {
      return res.status(400).json({ message: "Invalid job ID" });
    }

    const userId = req.user.id;
    console.log("Fetching job for userId:", userId, "jobId:", jobId);
    const [job] = await db.query("SELECT * FROM jobs WHERE id = ? AND posted_by = ?", [jobId, userId]);
    if (!job.length) {
      return res.status(404).json({ message: "Job not found or not authorized" });
    }

    const [results] = await db.query("SELECT * FROM job_applications WHERE job_id = ?", [jobId]);
    console.log("Applications found:", results);
    if (!results.length) {
      return res.status(404).json({ message: "No applications found for this job" });
    }

    res.json({ applications: results });
  } catch (error) {
    handleError(res, error, "Failed to fetch job applications");
  }
});

// --- Company Routes ---

//-----------------------------------------------------------------
// Fetch All Company Profiles
//-----------------------------------------------------------------
router.get("/companies", async (req, res) => {
  try {
    const [results] = await db.query(
      "SELECT id, company_name, logo, about, industry, headquarters, company_size, founded, website, rating, reviewsCount, jobs, reviews, email, contact_name FROM company_profiles"
    );
    const formattedResult = results.map((company) => ({
      ...company,
      jobs: parseJSON(company.jobs, company.id, "jobs"),
      reviews: parseJSON(company.reviews, company.id, "reviews"),
    }));
    res.json(formattedResult);
  } catch (error) {
    handleError(res, error, "Failed to fetch companies");
  }
});

//-----------------------------------------------------------------
// Fetch All Notifications for a User (Second Instance)
//-----------------------------------------------------------------
router.get("/notifications/:userId", authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    if (req.user.id !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const [notifications] = await db.query(
      "SELECT id, message, created_at, `read`, type FROM notifications WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    res.json({ notifications });
  } catch (error) {
    handleError(res, error, "Failed to fetch notifications");
  }
});

//-----------------------------------------------------------------
// Fetch Unread Notification Count for a User
//-----------------------------------------------------------------
router.get("/notifications/:userId/unread", authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    if (req.user.id !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const [result] = await db.query(
      "SELECT COUNT(*) as unreadCount FROM notifications WHERE user_id = ? AND `read` = 0",
      [userId]
    );
    res.json({ unreadCount: result[0].unreadCount });
  } catch (error) {
    handleError(res, error, "Failed to fetch unread notification count");
  }
});

module.exports = router;
