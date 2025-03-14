const mysql = require("mysql2/promise"); // Use the promise version
require("dotenv").config();

// Log the config to verify values
console.log("DB Config:", {
    host: process.env.DB_HOST || "192.168.1.28",
    user: process.env.DB_USER || "ritu",
    password: process.env.DB_PASSWORD || "Ritu9955",
    database: process.env.DB_NAME || "job_portal",
    port: process.env.DB_PORT || 3306
});

// Create a connection pool
const db = mysql.createPool({
    host: process.env.DB_HOST || "192.168.1.28",
    user: process.env.DB_USER || "ritu",
    password: process.env.DB_PASSWORD || "Ritu9955",
    database: process.env.DB_NAME || "job_portal",
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test the connection
(async () => {
    try {
        const connection = await db.getConnection();
        console.log("✅ Database Connected Successfully");
        connection.release(); // Release connection back to pool
    } catch (err) {
        console.error("❌ Database Connection Failed:", err.message);
    }
})();

module.exports = db;
