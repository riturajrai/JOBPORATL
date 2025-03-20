// middleware/authenticateToken.js
const jwt = require("jsonwebtoken");

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET , (err, user) => {
    if (err) {
      console.error("Token verification failed:", err.message);
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    if (!user.id) {
      console.error("Token missing user ID:", user);
      return res.status(400).json({ message: "Token does not contain user ID" });
    }
    req.user = user; // { id: userId, ...otherFields }
    next();
  });
};

module.exports = authenticateToken;

