const { router } = require("./services/router");
require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// health check
app.get("/", (req, res) => {
  res.send("Bot server is running!");
});

// webhook verify
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

// receive messages
app.post("/webhook", async (req, res) => {
  console.log("🔥 WEBHOOK RECEIVED");

  try {
    const entry = req.body.entry?.[0];
    const event = entry?.messaging?.[0];

    if (!event || !event.message || event.message.is_echo) {
      return res.sendStatus(200);
    }

    const senderId = event.sender?.id;
    const messageText = event.message?.text;

    if (!senderId || !messageText) {
      return res.sendStatus(200);
    }

    console.log("User:", messageText);

    const reply = await router(senderId, messageText);
    await sendMessage(senderId, reply);

  } catch (err) {
    console.log("❌ WEBHOOK ERROR:", err.message);
  }

  res.sendStatus(200);
});

// send message
async function sendMessage(psid, text) {
  try {
    await axios.post(
      "https://graph.facebook.com/v19.0/me/messages",
      {
        recipient: { id: psid },
        message: { text }
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