const db = require("../Database/database");

// ✅ Update Profile API (PUT)
const updateProfile = async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, location, linkedin, github } = req.body;

    console.log("Received Data:", { id, name, email, phone, location, linkedin, github });
    console.log("Received Files:", req.files);

    const profilePic = req.files?.profile_pic?.[0]?.filename ? `/uploads/${req.files.profile_pic[0].filename}` : null;
    const resumeLink = req.files?.resume?.[0]?.filename ? `/uploads/${req.files.resume[0].filename}` : null;

    if (!name || !email || !phone || !location) {
        return res.status(400).json({ message: "Name, email, phone, and location are required" });
    }

    try {
        const [user] = await db.query("SELECT profile_pic, resume_link FROM users WHERE id = ?", [id]);

        if (user.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const finalProfilePic = profilePic || user[0].profile_pic;
        const finalResumeLink = resumeLink || user[0].resume_link;

        const [result] = await db.query(
            `UPDATE users 
            SET name = ?, email = ?, phone = ?, location = ?, linkedin = ?, github = ?, profile_pic = ?, resume_link = ?
            WHERE id = ?`,
            [name, email, phone, location, linkedin, github, finalProfilePic, finalResumeLink, id]
        );

        console.log("Update Result:", result);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.json({ 
            message: "Profile updated successfully!", 
            profile_pic: finalProfilePic,
            resume_link: finalResumeLink
        });

    } catch (err) {
        console.error("Error updating profile:", err);
        return res.status(500).json({ message: "Profile update failed" });
    }
};

//  Upload Resume API (POST)
const uploadResume = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded!" });
        }

        const resumePath = `/uploads/${req.file.filename}`;
        console.log("Uploaded File Path:", resumePath);

        const [result] = await db.query("UPDATE users SET resume_link = ? WHERE id = ?", [resumePath, req.params.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.json({ message: "Resume uploaded successfully!", resume_link: resumePath });

    } catch (error) {
        console.error("Resume Upload Error:", error);
        return res.status(500).json({ message: "Server error while uploading resume" });
    }
};

// get user profulwe
const getUserProfile = async (req, res) => {
    const { id } = req.params;

    try {
        console.log("Fetching user with ID:", id);
        const [user] = await db.query("SELECT * FROM users WHERE id = ?", [id]);

        if (user.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        console.log("User Data:", user[0]); 
        return res.json(user[0]);

    } catch (err) {
        console.error("Error fetching user:", err);
        return res.status(500).json({ message: "Error fetching user profile" });
    }
};


module.exports = { updateProfile, uploadResume, getUserProfile };
