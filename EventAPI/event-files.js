const express = require("express");
const router = express.Router();
const conn = require("./dbConnection");
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "uploads"));
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const formattedName = (req.body.name || "default").replace(/\s+/g, "_");
    const extension = path.extname(file.originalname).toLowerCase();

    // Determine the prefix based on the fieldname
    let filenamePrefix = "";
    if (file.fieldname === "hero_img") {
      filenamePrefix = "category_heroimg";
    } else if (file.fieldname === "logo_img") {
      filenamePrefix = "category_logoimg";
    } else {
      // Handle unexpected fieldname
      return cb(new Error("Unexpected fieldname"));
    }

    const filename = `${filenamePrefix}_${formattedName}_${timestamp}${extension}`;
    cb(null, filename);
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
        console.error("Invalid mimetype:", mimetype);
        // Delete the file if it doesn't have a valid extension
        fs.unlinkSync(file.path);
        continue; // Skip saving the file to the database
      }

      const timestamp = Date.now();
      // Construct new filename to ensure uniqueness
      const newFilename = `img_${event_id}_${timestamp}${path.extname(
        filename
      )}`;
      // Construct the path that will be saved in the database
      const savePath = `uploads/${newFilename}`;

      // Insert file information into the database, including created_at and is_approved
      const query =
        "INSERT INTO Event_Files (event_id, filename, type, path, created_at, is_approved) VALUES (?, ?, ?, ?, NOW(), 1)";
      await conn.query(query, [event_id, newFilename, mimetype, savePath]);
    }

    console.log("Files uploaded successfully");
    res.json({
      success: true,
      message: "Files uploaded successfully",
      is_approved: 1,
    });
  } catch (err) {
    console.error("Error uploading files:", err);
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
    res.status(200).json({ success: true, files: results });
  });
});
module.exports = router;
