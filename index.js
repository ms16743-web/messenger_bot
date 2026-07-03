const fs = require("fs");
require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
let academy = {};

try {
  academy = JSON.parse(
    fs.readFileSync("./knowledge/academy.json", "utf8")
  );
} catch (err) {
  console.log("❌ Failed to load academy.json:", err.message);
}
// health check
app.get("/", (req, res) => {
  res.send("Bot server is running!");
});

// webhook verify (Meta)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("VERIFY HIT:", req.query);

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// receive messages (THIS WAS MISSING BEFORE)
app.post("/webhook", async (req, res) => {
  console.log("🔥 WEBHOOK RECEIVED");
  console.log(JSON.stringify(req.body, null, 2));

  const entry = req.body.entry?.[0];
  const event = entry?.messaging?.[0];

  const senderId = event?.sender?.id;
  const messageText = event?.message?.text;

  if (senderId && messageText) {
    console.log("User:", messageText);

    // simple auto-reply
   const reply = generateReply(messageText);
await sendMessage(senderId, reply);
  }

  res.sendStatus(200);
});
function generateReply(text) {
  const msg = text.toLowerCase();

  if (msg.includes("ai")) {
    return `Nice! AI Academy Asia offers structured AI learning programs for different levels. Do you want Junior, Adult, or Company training?`;
  }

  if (msg.includes("price") || msg.includes("cost")) {
    return `I can help with that 👍 Pricing depends on the program. May I know your age or goal so I can guide you better?`;
  }

  if (msg.includes("hello") || msg.includes("hi")) {
    return `Hi 👋 Welcome to AI Academy Asia! What would you like to learn today? AI, programming, or automation?`;
  }

  return `Thanks for your message 👍 Can you tell me a bit more about what you want to learn so I can guide you properly?`;
}
// send message function
async function sendMessage(psid, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/me/messages`,
      {
        recipient: { id: psid },
        message: { text: text }
      },
      {
        params: {
          access_token: PAGE_ACCESS_TOKEN
        }
      }
    );

    console.log("✅ Message sent");
  } catch (err) {
    console.log("❌ Send error:", err.response?.data || err.message);
  }
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});