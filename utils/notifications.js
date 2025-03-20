const db = require("../Database/database");

// Function to create a notification
const createNotification = async (userId, message, type = "info") => {
  try {
    const [result] = await db.query(
      "INSERT INTO notifications (user_id, message, type, created_at) VALUES (?, ?, ?, NOW())",
      [userId, message, type]
    );
    console.log(`Notification created for user ${userId}: ${message}`);
    return result.insertId; // Return the ID of the new notification
  } catch (error) {
    console.error("Error creating notification:", error.message);
    throw error; // Let the caller handle the error
  }
};

module.exports = { createNotification };