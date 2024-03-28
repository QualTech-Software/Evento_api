const express = require("express");
const router = express.Router();
const multer = require("multer");
const conn = require("./dbConnection");
const path = require("path");

// Define storage configuration for multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Specify the destination directory where uploaded files will be stored
    //ToDo-It is Temporory Folder we will move to s3 bucket
    cb(null, path.join(__dirname, "/uploads"));
  },
  filename: function (req, file, cb) {
    // Use the original filename of the uploaded file
    cb(null, file.originalname);
  },
});
const upload = multer({ storage: storage });

router.get("/", function (req, res) {
  res.send("New Things");
});

//API EVENTSFILES

router.post("/event-files", upload.single("filename"), async (req, res) => {
  try {
    const { event_id } = req.body;
    const { filename, mimetype } = req.file;

    // Insert file information into the database
    const query = `INSERT INTO Event_Files (event_id, filename, type, path) VALUES (?, ?, ?, ?)`;
    conn.query(
      query,
      [event_id, filename, mimetype, req.file.path],
      function (err, result) {
        if (err) {
          console.error(err);
          res
            .status(500)
            .json({ success: false, message: "Failed to upload file" });
          return;
        }
        console.log("File uploaded successfully");
        res.json({ success: true, message: "File uploaded successfully" });
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to upload file" });
  }
});

// POST route to create a new event
router.post("/events", (req, res, next) => {
  const {
    title,
    category_id,
    start_date_time,
    end_date_time,
    is_online,
    location,
    address,
    city,
    state,
    country,
    zip_code,
    additional_information,
    rules_regulations,
  } = req.body;
  const query = `INSERT INTO Events (title, category_id, start_date_time, end_date_time, is_online, location, address, city, state, country, zip_code, additional_information, rules_regulations) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  conn.query(
    query,
    [
      title,
      category_id,
      start_date_time,
      end_date_time,
      is_online,
      location,
      address,
      city,
      state,
      country,
      zip_code,
      additional_information,
      rules_regulations,
    ],
    (err, results) => {
      if (err) return next(err);
      res.status(201).json({
        message: "Event created successfully",
        eventId: results.insertId,
      });
    }
  );
});

// GET route to fetch all events
router.get("/events", (req, res, next) => {
  const query = "SELECT * FROM Events";

  conn.query(query, (err, results) => {
    if (err) return next(err);
    res.status(200).json(results);
  });
});

// PUT route to update an event
router.put("/events/:id", (req, res, next) => {
  const { id } = req.params;
  // Assuming body contains fields to update
  const updates = req.body;
  const fields = Object.keys(updates)
    .map((key) => `${key} = ?`)
    .join(", ");
  const values = Object.values(updates);

  const query = `UPDATE Events SET ${fields} WHERE id = ?`;

  conn.query(query, [...values, id], (err, result) => {
    if (err) return next(err);
    res.status(200).json({ message: "Event updated successfully" });
  });
});

router.delete("/events/:id", (req, res, next) => {
  const { id } = req.params;
  const query = "DELETE FROM Events WHERE id = ?";

  conn.query(query, [id], (err, result) => {
    if (err) return next(err);
    res.status(200).json({ message: "Event deleted successfully" });
  });
});

module.exports = router;
