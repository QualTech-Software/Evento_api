const express = require("express");
const router = express.Router();
const conn = require("./dbConnection");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "uploads"));
  },
  filename: function (req, file, cb) {
    // Temporary unique name for the file
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});
const upload = multer({ storage: storage });
router.post("/event-files", upload.array("filename", 4), async (req, res) => {
  try {
    const { event_id } = req.body;

    if (!event_id) {
      return res
        .status(400)
        .json({ success: false, message: "Missing event_id in request body" });
    }

    // Process each file in the request
    for (const file of req.files) {
      const { filename, mimetype } = file;

      // Check if mimetype is a valid image MIME type ('image/png', 'image/jpeg', 'image/gif')
      if (!["image/png", "image/jpeg", "image/jpg"].includes(mimetype)) {
        fs.unlinkSync(file.path);

        continue; // Skip saving the file to the database
      }

      const timestamp = Date.now();
      // Construct new filename to ensure uniqueness and match database format
      const newFilename = `img_${event_id}_${timestamp}${path.extname(
        filename
      )}`;
      // Construct the path that will be saved in the database
      const savePath = `uploads/${newFilename}`;

      // Insert file information into the database, including created_at and is_approved
      const query =
        "INSERT INTO Event_Files (event_id, filename, type, path, created_at, is_approved) VALUES (?, ?, ?, ?, NOW(), 1)";
      await conn.query(query, [event_id, newFilename, mimetype, savePath]);

      // Rename the uploaded file to match the database filename
      fs.renameSync(file.path, path.join(__dirname, "uploads", newFilename));
    }

    res.json({
      success: true,
      message: "Files uploaded successfully",
      is_approved: 1,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Invalid File Format" });
  }
});

router.get("/event-files", (req, res, next) => {
  const query = "SELECT * FROM Event_Files";

  conn.query(query, (err, results) => {
    if (err) {
      console.error("Error querying database:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to fetch uploaded files" });
    }
    // Modify the path of each file to match the upload directory
    results.forEach((file) => {
      file.path = path.join(__dirname, file.path);
    });
    res.status(200).json({ success: true, files: results });
  });
});
module.exports = router;
