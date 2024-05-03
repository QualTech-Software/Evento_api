const express = require("express");
var app = express();
const router = express.Router();
const db = require("./dbConnection");
const { signupValidation, loginValidation } = require("./validation");
const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

router.get("/", function (req, res) {
  res.send("New Things");
});

app.use(express.static(__dirname + "/"));

router.post("/register", signupValidation, async (req, res, next) => {
  try {
    const existingUser = await db.query(
      `SELECT * FROM users WHERE LOWER(email) = LOWER(?)`,
      [req.body.email]
    );

    if (existingUser.length) {
      return res.status(409).send({
        msg: "This user is already in use!",
      });
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    await db.query(
      `INSERT INTO users (email, password, phoneNumber, firstName, lastName) VALUES (?, ?, ?, ?, ?)`,
      [
        req.body.email,
        hashedPassword,
        req.body.phoneNumber,
        req.body.firstName,
        req.body.lastName,
      ]
    );

    return res.status(201).send({
      msg: "The user has been registered with us!",
    });
  } catch (error) {
    return res.status(500).send({
      msg: "Internal server error",
    });
  }
});

let tokenAccessCount = 0; // Initialize token access counter

router.post("/login", loginValidation, (req, res, next) => {
  db.query(
    `SELECT * FROM users WHERE email = ${db.escape(req.body.email)};`,
    (err, result) => {
      // user does not exist
      if (err) {
        throw err;
        return res.status(400).send({
          msg: err,
        });
      }
      if (!result.length) {
        return res.status(401).send({
          msg: "Email or password is incorrect!",
        });
      }
      // check password
      bcrypt.compare(
        req.body.password,
        result[0]["password"],
        (bErr, bResult) => {
          // wrong password
          if (bErr) {
            throw bErr;
            return res.status(401).send({
              msg: "Email or password is incorrect!",
            });
          }
          if (bResult) {
            const token = jwt.sign(
              { id: result[0].id },
              "the-super-strong-secrect",
              { expiresIn: "1h" }
            );
            db.query(
              `UPDATE users SET last_login = now() WHERE id = '${result[0].id}'`
            );

            // Increment token access count and log it
            tokenAccessCount++;
            console.log("Token access count:", tokenAccessCount);

            return res.status(200).send({
              msg: "Logged in!",
              token,
              user: result[0],
            });
          }
          return res.status(401).send({
            msg: "Username or password is incorrect!",
          });
        }
      );
    }
  );
});

router.post("/get-user", signupValidation, (req, res, next) => {
  if (
    !req.headers.authorization ||
    !req.headers.authorization.startsWith("Bearer") ||
    !req.headers.authorization.split(" ")[1]
  ) {
    return res.status(422).json({
      message: "Please provide the token",
    });
  }

  const theToken = req.headers.authorization.split(" ")[1];
  const decoded = jwt.verify(theToken, "the-super-strong-secrect");

  db.query(
    "SELECT * FROM users where id=?",
    decoded.id,
    function (error, results, fields) {
      if (error) throw error;
      return res.send({
        error: false,
        data: results[0],
        message: "Fetch Successfully.",
      });
    }
  );
});

router.get("/about", function (req, res) {
  res.send("About this wiki");
});

module.exports = router;
