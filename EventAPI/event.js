const express = require("express");
const router = express.Router();
const conn = require("./dbConnection");
const moment = require("moment");

router.post("/event", (req, res, next) => {
  const eventData = ({
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
  } = req.body);

  // Validate city, state, and country to ensure they are strings
  // if (
  //   typeof city !== "string" ||
  //   typeof state !== "string" ||
  //   typeof country !== "string"
  // ) {
  //   return res
  //     .status(400)
  //     .json({ message: "City, state, and country must be strings" });
  // }
  // if (typeof zip_code !== "number") {
  //   return res.status(400).json({ message: "Zip code is invalid" });
  // }
  // // Ensure city, state, and country match the expected format
  // const regex = /^[a-zA-Z]+$/;
  // if (!regex.test(city) || !regex.test(state) || !regex.test(country)) {
  //   return res
  //     .status(400)
  //     .json({ message: "Invalid characters in city, state, or country name" });
  // }
  // const now = new Date();
  // if (new Date(start_date_time) < now) {
  //   return res.status(400).json({ message: "Start date_time is invalid" });
  // }

  // if (new Date(end_date_time) < new Date(start_date_time)) {
  //   return res.status(400).json({ message: "End date_time is invalid" });
  // }
  start_date_time = moment(start_date_time).format("YYYY-MM-DD HH:mm:ss");
  end_date_time = moment(end_date_time).format("YYYY-MM-DD HH:mm:ss");
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
  const locationPathPrefix = "http://localhost:3000/";
  const query = `
    SELECT 
      CONCAT( 
        "[", 
        GROUP_CONCAT(
          CONCAT('{ "filename":"', Event_Files.filename, '", "path":"${locationPathPrefix}', Event_Files.path, '"}')
        ), 
        "]" 
      ) as files, 
      events.* 
    FROM 
      Events 
    LEFT JOIN 
      Event_Files 
    ON 
      Events.id = Event_Files.event_id 
    GROUP BY 
      events.id
  `;

  conn.query(query, (err, results) => {
    if (err) return next(err);
    res.status(200).json(results);
  });
});

// GET route to fetch all events
router.post("/filtered-events/", (req, res, next) => {
  const locationPathPrefix = "http://localhost:3000/";
  const data = req.body;

  console.log(JSON.stringify(data));

  console.log(data);

  let whereSql = [];
  if (data?.is_paid == "0" || data?.is_paid == "1") {
    whereSql.push(" AND Events.is_paid = " + data["is_paid"]);
  }

  if (data?.category_id) {
    whereSql.push(" AND Events.category_id = " + data["category_id"]);
  }

  if (data?.dates && data?.dates?.length > 0) {
    let dateSQLs = data?.dates.map(
      (date) =>
        `( Events.start_date_time <= '${date}' AND Events.end_date_time >= '${date}'  )`
    );
    console.log(dateSQLs);
    if (dateSQLs.length > 0) {
      whereSql.push(" AND (" + dateSQLs.join(" OR ") + ")");
    }
  }

  if (data?.is_paid) {
    whereSql.push(` AND is_paid = '${data?.is_paid}'`);
  }

  // Add condition to filter events for today
  if (data?.today) {
    const currentDate = new Date().toISOString().slice(0, 10); // Get current date in YYYY-MM-DD format
    whereSql.push(` AND DATE(Events.start_date_time) = '${currentDate}'`);
  }

  // Add condition to filter events for tomorrow
  if (data?.tomorrow) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1); // Get the next day
    const tomorrowDate = tomorrow.toISOString().slice(0, 10); // Get tomorrow's date in YYYY-MM-DD format
    whereSql.push(
      ` AND (DATE(Events.start_date_time) = '${tomorrowDate}' OR DATE(Events.end_date_time) = '${tomorrowDate}')`
    );
  }

  const query = `
    SELECT 
      CONCAT( 
        "[", 
        GROUP_CONCAT(
          CONCAT('{ "filename":"', Event_Files.filename, '", "path":"${locationPathPrefix}', Event_Files.path, '"}')
        ), 
        "]" 
      ) as files, 
      events.* 
    FROM 
      Events 
    LEFT JOIN 
      Event_Files 
    ON 
      Events.id = Event_Files.event_id 
    WHERE
         1 
    ${whereSql.join(" ")}
    GROUP BY 
      events.id
  `;

  console.log(query);

  conn.query(query, (err, results) => {
    if (err) return next(err);
    res.status(200).json(results);
  });
});

router.get("/categories-events/:category_id", (req, res, next) => {
  const categoryId = req.params.category_id;
  const locationPathPrefix = "http://localhost:3000/";
  const query =
    'SELECT CONCAT( "[", GROUP_CONCAT(concat(\'{ "filename":"\',Event_Files.filename,\'", path:"' +
    +locationPathPrefix +
    +"', Event_Files.path, '\"}') ), \"]\" ) as files, events.* FROM Events INNER JOIN Event_Files ON Events.id = Event_Files.event_id WHERE events.category_id = " +
    categoryId +
    " GROUP BY events.id;";

  conn.query(query, (err, results) => {
    if (err) return next(err);
    res.status(200).json(results);
  });
});

// GET route to fetch all events
// router.get("/events", (req, res, next) => {
//   const query = "SELECT * FROM Events";

//   conn.query(query, (err, results) => {
//     if (err) return next(err);
//     res.status(200).json(results);
//   });
// });

//GET for given id
router.get("/event/:id", (req, res, next) => {
  const eventId = req.params.id;
  const query = `
    SELECT Event_Files.filename, Event_Files.path
    FROM Events
    INNER JOIN Event_Files ON Events.id = Event_Files.event_id
    WHERE Events.id = ?
  `;
  /**
   * 
   * SELECT   GROUP_CONCAT(concat('{ "filename":"',Event_Files.filename,'", path:"', Event_Files.path, '"}') ), events.* 
    FROM Events
    INNER JOIN Event_Files ON Events.id = Event_Files.event_id;
   */

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
