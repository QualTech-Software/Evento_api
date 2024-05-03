const express = require("express");
const router = express.Router();
const multer = require("multer");
const conn = require("./dbConnection");
const path = require("path");
const { json } = require("body-parser");

// Define storage configuration for multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "uploads"));
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const name = req.body.name || "default"; // Fallback name in case it's not provided
    const formattedName = name.replace(/\s+/g, "_");
    const extension = path.extname(file.originalname).toLowerCase();
    let filenamePrefix = "";

    if (file.fieldname === "hero_img") {
      filenamePrefix = `category_heroimg_${formattedName}_${timestamp}`;
    } else if (file.fieldname === "logo_img") {
      filenamePrefix = `category_iconimg_${formattedName}_${timestamp}`;
    }

    const newName = `${filenamePrefix}${extension}`;
    cb(null, newName);
  },
});

const upload = multer({ storage: storage });

router.get("/", function (req, res) {
  res.send("New Things");
});

//API EVENTSFILES
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
      return res
        .status(500)
        .json({ success: false, message: "Failed to fetch uploaded files" });
    }
    res.status(200).json({ success: true, files: results });
  });
});

//API for EVENT-CATEGORIES
router.post(
  "/category",
  upload.fields([
    { name: "hero_img", maxCount: 1 },
    { name: "logo_img", maxCount: 1 },
  ]),
  (req, res, next) => {
    // Extract required data from the request body
    const { name, is_active, parent_category_id } = req.body;
    const hero_img = req.files["hero_img"][0];
    const logo_img = req.files["logo_img"][0];

    // Ensure file extensions are lowercase
    const hero_img_extension = hero_img.originalname
      .split(".")
      .pop()
      .toLowerCase();
    const logo_img_extension = logo_img.originalname
      .split(".")
      .pop()
      .toLowerCase();

    // Check if file extensions are valid
    const allowedExtensions = ["png", "jpg", "jpeg"];
    if (
      !allowedExtensions.includes(hero_img_extension) ||
      !allowedExtensions.includes(logo_img_extension)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid file type. Only PNG, JPG, and JPEG files are allowed.",
      });
    }

    // Map various input formats of is_active to corresponding integer values
    let isActiveInt;
    if (
      is_active === "1" ||
      is_active.toLowerCase() === "true" ||
      is_active.toLowerCase() === "yes"
    ) {
      isActiveInt = 1;
    } else if (
      is_active === "0" ||
      is_active.toLowerCase() === "false" ||
      is_active.toLowerCase() === "no"
    ) {
      isActiveInt = 0;
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid value for is_active.",
      });
    }

    // Query the database to fetch the category_id for the given category name
    const categoryIdQuery = `
      SELECT parent_category_id FROM categories WHERE name = ?
    `;

    conn.query(categoryIdQuery, [name], (queryErr, queryResult) => {
      if (queryErr) {
        return res.status(500).json({
          success: false,
          message: "Failed to fetch category_id",
          error: queryErr.message, // Return the error message for debugging
        });
      }

      // if (queryResult.length === 0) {
      //   return res.status(404).json({
      //     success: false,
      //     message: "Category not found",
      //   });
      // }

      const categoryId = queryResult[0]?.parent_category_id || 0;

      // Generate timestamp
      const timestamp = Date.now();
      const formattedName = name.replace(/\s+/g, "_");

      // Construct the paths with file extensions
      const heroImgPath = `category_heroimg_${formattedName}_${timestamp}.${hero_img_extension}`;
      const logoImgPath = `category_iconimg_${formattedName}_${timestamp}.${logo_img_extension}`;
      // Construct the SQL query to insert a new category into the database
      const query = `
        INSERT INTO categories (parent_category_id, name, hero_img, logo_img, is_active) 
        VALUES (?, ?, ?, ?, ?)
      `;

      // Execute the query
      conn.query(
        query,
        [parent_category_id, name, heroImgPath, logoImgPath, isActiveInt],
        (err, result) => {
          if (err) {
            return res.status(500).json({
              success: false,
              message: "Failed to create category",
              error: err.message, // Return the error message for debugging
            });
          }
          res.status(201).json({
            success: true,
            message: "Category created successfully",
            parent_category_id: categoryId,
            hero_img_path: heroImgPath,
            logo_img_path: logoImgPath,
          });
        }
      );
    });
  }
);

// Route handler for getting all event categories
router.get("/category/:category_id", (req, res, next) => {
  const categoryId = req.params.category_id;
  const query = "SELECT * FROM categories WHERE id = ? and is_active = 1";
  const query2 =
    "SELECT * FROM categories WHERE parent_category_id = ? and is_active = 1";

  conn.query(query, [categoryId], (err, results) => {
    if (err) {
      console.error("Error fetching categories:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to fetch categories" });
    }

    res.status(200).json({
      success: true,
      categories: { results, sub_categories: sub_categories },
    });
  });
});
// POST route to create a new event
router.post("/event", (req, res, next) => {
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

  // Validate city, state, and country to ensure they are strings
  if (
    typeof city !== "string" ||
    typeof state !== "string" ||
    typeof country !== "string"
  ) {
    return res
      .status(400)
      .json({ message: "City, state, and country must be strings" });
  }
  if (typeof zip_code !== "number") {
    return res.status(400).json({ message: "Zip code is invalid" });
  }
  // Ensure city, state, and country match the expected format
  const regex = /^[a-zA-Z]+$/;
  if (!regex.test(city) || !regex.test(state) || !regex.test(country)) {
    return res
      .status(400)
      .json({ message: "Invalid characters in city, state, or country name" });
  }
  const now = new Date();
  if (new Date(start_date_time) < now) {
    return res.status(400).json({ message: "Start date_time is invalid" });
  }

  // Validate end_date_time is after start_date_time
  if (new Date(end_date_time) <= new Date(start_date_time)) {
    return res.status(400).json({ message: "End date_time is invalid" });
  }

  // Construct the INSERT query with the uploaded_at column
  const query = `
    INSERT INTO Events (
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
      uploaded_at
    ) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;

  // Execute the INSERT query with the uploaded_at column
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
//GET for given id
router.get("/event/:id", (req, res, next) => {
  const eventId = req.params.id;
  const query = `
    SELECT Event_Files.filename, Event_Files.path
    FROM Events
    INNER JOIN Event_Files ON Events.id = Event_Files.event_id
    WHERE Events.id = ?
  `;

  var images = {};
  var eventDetails = {};

  conn.query(query, [eventId], (err, results) => {
    if (err) {
      console.error("Error fetching Data:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to fetch Data" });
    }

    images = results;
  });

  const query2 = `
    SELECT * FROM Events WHERE Events.id = ?
  `;

  conn.query(query2, [eventId], (err, results) => {
    if (err) {
      console.error("Error fetching Data:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to fetch Data" });
    }

    eventDetails = results;
    res.status(200).json({
      success: true,
      event: {
        eventDetails: eventDetails,
        images: images,
      },
    });
  });
});

// PUT route to update an event
router.put("/event/:id", (req, res, next) => {
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

router.delete("/event/:id", (req, res, next) => {
  const { id } = req.params;
  const query = "DELETE FROM Events WHERE id = ?";

  conn.query(query, [id], (err, result) => {
    if (err) return next(err);
    res.status(200).json({ message: "Event deleted successfully" });
  });
});

module.exports = router;
