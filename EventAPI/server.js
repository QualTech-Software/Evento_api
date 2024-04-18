const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const eventRouter = require("./event.js");
const categoryRouter = require("./category.js");
const eventFilesRouter = require("./event-files.js");
const path = require("path");
const app = express();

// Middleware
app.use(express.json());
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.use(cors());

// Routes
app.use("/api", eventRouter);
app.use("/api", categoryRouter);
app.use("/api", eventFilesRouter);
app.use((err, req, res, next) => {
  // console.log(err);
  err.statusCode = err.statusCode || 500;
  err.message = err.message || "Internal Server Error";
  res.status(err.statusCode).json({
    message: err.message,
  });
});
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
