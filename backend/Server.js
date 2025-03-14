require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const postRoutes = require("./controllers/Post");
const getUserRoutes = require("./controllers/Get");
const ProfileData = require("./controllers/Put");
const DeleteRouter = require('./controllers/delete.JS');

const app = express();

app.use(cors({
  origin: "*",
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Static folder for image uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ Use Routes
app.use("/api", postRoutes);
app.use("/api", getUserRoutes);
app.use("/api", ProfileData);
app.use("/api", DeleteRouter);

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`🌍 Server is running at http://localhost:${PORT}`);
  console.log('Server running on http://192.168.1.28:5000');
});