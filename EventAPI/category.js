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
      SELECT id FROM categories WHERE name = ?
    `;

    conn.query(categoryIdQuery, [name], (queryErr, queryResult) => {
      if (queryErr) {
        console.error("Error fetching categoryId:", queryErr);
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

      const categoryId = queryResult[0]?.id || 0;

      // Generate timestamp
      const timestamp = Date.now();
      const formattedName = name.replace(/\s+/g, "_");

      // Construct the paths with file extensions
      const heroImgPath = `category_heroimg_${formattedName}_${timestamp}.${hero_img_extension}`;
      const logoImgPath = `category_logoimg_${formattedName}_${timestamp}.${logo_img_extension}`;
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
            console.error("Error creating category:", err);
            return res.status(500).json({
              success: false,
              message: "Failed to create category",
              error: err.message, // Return the error message for debugging
            });
          }
          res.status(201).json({
            success: true,
            message: "Category created successfully",
            category_id: categoryId,
            hero_img_path: heroImgPath,
            logo_img_path: logoImgPath,
          });
        }
      );
    });
  }
);
router.get("/category", (req, res) => {
  const { name } = req.query;
  const selectQuery = "SELECT id FROM categories WHERE name=?";
  conn.query(selectQuery, [name], (err, results) => {
    if (err) {
      console.error("Error fetching categories:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to fetch categories" });
    }
    res.status(200).json({ success: true, categories: results });
  });
});
router.get("/categories/main", (req, res, next) => {
  const query = `
    SELECT 
      id AS category_id,
      name,
      CONCAT('http://localhost:3000/uploads/', hero_img) AS hero_img, 
      CONCAT('http://localhost:3000/uploads/', logo_img) AS logo_img
    FROM categories
    WHERE is_active = 1
  `;

  conn.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching categories:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to fetch categories" });
    }

    res.status(200).json({ success: true, categories: results });
  });
});
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
      categories: results, // Remove { } around results to send the array directly
    });
  });
});
module.exports = router;
