const multer = require("multer");
const fs = require("fs");
const path = require("path");

// Ensure "uploads" folder exists
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Define storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Sanitize the filename by replacing spaces and special characters
        const sanitizedFilename = file.originalname
            .replace(/[^a-zA-Z0-9.]/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");
        cb(null, Date.now() + "-" + sanitizedFilename);
    }
});


const fileFilter = (req, file, cb) => {
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx'];
    const extension = path.extname(file.originalname).toLowerCase();
    const allowedMimetypes = {
      '.jpg': ['image/jpeg', 'image/jpg'],
      '.jpeg': ['image/jpeg', 'image/jpg'],
      '.png': 'image/png',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/msword'
    };
    if (allowedExtensions.includes(extension) && (allowedMimetypes[extension].includes(file.mimetype))) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, JPEG, PNG, PDF, DOC, and DOCX files are allowed'), false);
    }
  };
// Configure multer for multiple files
const upload = multer({ 
    storage, 
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB file size limit
    }
});

// Middleware for multiple file uploads
const uploadFiles = upload.fields([{ name: "profile_pic", maxCount: 1 }, { name: "resume", maxCount: 1 }]);

// Custom error handler for multer
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ message: "File too large. Maximum allowed size is 5MB." });
        }
        return res.status(400).json({ message: err.message });
    } else if (err) {
        return res.status(400).json({ message: err.message });
    }
    next();
};

module.exports = { upload, uploadFiles, handleMulterError };

