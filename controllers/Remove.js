const express = require("express");
const router = express.Router(); // Lowercase for convention
const db = require("../Database/database");
const authenticateToken = require("../middleware/authenticateToken");

const handleError = (res, error, message = "Server error", status = 500) => {
  console.error(`${message}:`, error.message);
  res.status(status).json({
    message,
    ...(process.env.NODE_ENV === "development" && { error: error.message }),
  });
};

//-----------------------------------------------------------------
// Remove a Saved Job
//-----------------------------------------------------------------
router.delete("/jobs/:jobId/save", authenticateToken, async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    if (isNaN(jobId)) return res.status(400).json({ message: "Invalid job ID" });
    const [result] = await db.query("DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?", [req.user.id, jobId]);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Saved job not found" });
    res.json({ message: "Job removed from saved list" });
  } catch (error) {
    handleError(res, error, "Failed to remove saved job");
  }
});

//-----------------------------------------------------------------
// Withdraw a Job Application
//-----------------------------------------------------------------
router.delete("/applications/:jobId", authenticateToken, async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    if (isNaN(jobId)) return res.status(400).json({ message: "Invalid job ID" });
    const [result] = await db.query("DELETE FROM job_applications WHERE user_id = ? AND job_id = ?", [req.user.id, jobId]);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Application not found" });
    res.json({ message: "Application withdrawn successfully" });
  } catch (error) {
    handleError(res, error, "Failed to withdraw application");
  }
});

//-----------------------------------------------------------------
// Delete a Job (Employer Only)
//-----------------------------------------------------------------
router.delete("/jobs/:jobId", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "employer") {
      return res.status(403).json({ message: "Only employers can delete jobs" });
    }
    const jobId = parseInt(req.params.jobId);
    if (isNaN(jobId)) return res.status(400).json({ message: "Invalid job ID" });
    const [job] = await db.query("SELECT id FROM jobs WHERE id = ? AND posted_by = ?", [jobId, req.user.id]);
    if (!job.length) {
      return res.status(404).json({ message: "Job not found or you are not authorized to delete it" });
    }
    await db.query("DELETE FROM jobs WHERE id = ?", [jobId]);
    res.json({ message: "Job deleted successfully" });
  } catch (error) {
    handleError(res, error, "Failed to delete job");
  }
});

//-----------------------------------------------------------------
// Delete a Notification
//-----------------------------------------------------------------
router.delete("/notifications/:id", authenticateToken, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    if (isNaN(notificationId)) return res.status(400).json({ message: "Invalid notification ID" });
    const [result] = await db.query("DELETE FROM notifications WHERE id = ? AND user_id = ?", [notificationId, req.user.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Notification not found or not owned by user" });
    res.json({ message: "Notification deleted successfully" });
  } catch (error) {
    handleError(res, error, "Failed to delete notification");
  }
});

module.exports = router;
