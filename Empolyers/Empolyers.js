const express = require('express');
const DB = require('../Database/database');

const company_employerid = (req, res) => {
  const { id } = req.params;
  const sql = "SELECT * FROM employers WHERE id = ?";
  DB.query(sql, [id], (err, result) => {
    if (err) {
      console.error("Error fetching employers:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
    if (result.length === 0) {
      return res.status(404).json({ message: "Employer not found" });
    }
    return res.status(200).json(result[0]); // Return single object instead of array
  });
};

const companyProfile = (req, res) => {
  const userId = req.params.userId;
  const token = req.headers.authorization?.split(" ")[1];

  // Validate token
  if (!token) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  const sql = `
    SELECT id, company_name, logo, about, industry, headquarters, company_size, 
           founded, website, rating, reviewsCount, jobs, reviews, email, contact_name, created_at 
    FROM company_profiles 
    WHERE id = ?
  `;

  DB.query(sql, [userId], (err, result) => {
    if (err) {
      console.error("Error fetching company profile:", err);
      return res.status(500).json({ message: "Internal server error while fetching company profile" });
    }

    if (result.length === 0) {
      return res.status(404).json({ message: "Company profile not found" });
    }

    // Log raw data for debugging
    console.log("Raw company profile data:", result[0]);

    // Safely parse JSON fields
    let jobs = [];
    let reviews = [];
    
    try {
      jobs = result[0].jobs ? JSON.parse(result[0].jobs) : [];
    } catch (parseErr) {
      console.error("Error parsing jobs JSON:", parseErr, "Raw data:", result[0].jobs);
      jobs = []; // Fallback to empty array
    }

    try {
      reviews = result[0].reviews ? JSON.parse(result[0].reviews) : [];
    } catch (parseErr) {
      console.error("Error parsing reviews JSON:", parseErr, "Raw data:", result[0].reviews);
      reviews = []; // Fallback to empty array
    }

    const profile = {
      ...result[0],
      jobs,
      reviews,
    };

    return res.status(200).json(profile);
  });
};

module.exports = { company_employerid, companyProfile };