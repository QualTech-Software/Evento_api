const { check } = require("express-validator");

exports.signupValidation = [
  check("email", "Please include a valid email")
    .isEmail()
    .normalizeEmail({ gmail_remove_dots: true }),
  check("password", "Password must be 8 or more characters").isLength({
    min: 8,
  }),
];

exports.loginValidation = [
  check("email", "Please include a valid email")
    .isEmail()
    .normalizeEmail({ gmail_remove_dots: true }),
  check("password", "Password must be 8 or more characters").isLength({
    min: 8,
  }),
];
