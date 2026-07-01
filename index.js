require("dotenv").config();

const express = require("express");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

console.log("VERIFY_TOKEN from env:", VERIFY_TOKEN);

// test route
app.get("/", (req, res) => {
  res.send("Bot server is running!");
});

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Server is healthy"
  });
});

// webhook verify (Meta)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("Mode:", mode);
  console.log("Token:", token);
  console.log("Challenge:", challenge);

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});