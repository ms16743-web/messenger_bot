const fs = require("fs");
require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// 🧠 memory (per user)
const userState = {};

// 📦 load academy knowledge
let academy = {};

try {
  academy = JSON.parse(
    fs.readFileSync("./knowledge/academy.json", "utf8")
  );
} catch (err) {
  console.log("❌ Failed to load academy.json:", err.message);
}

// =====================
// HEALTH CHECK
// =====================
app.get("/", (req, res) => {
  res.send("Bot server is running!");
});

// =====================
// WEBHOOK VERIFY
// =====================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// =====================
// RECEIVE MESSAGES
// =====================
app.post("/webhook", async (req, res) => {
  console.log("🔥 WEBHOOK RECEIVED");

  const entry = req.body.entry?.[0];
  const event = entry?.messaging?.[0];

  const senderId = event?.sender?.id;
  const messageText = event?.message?.text;

  if (senderId && messageText) {
    console.log("User:", messageText);

    // init state
    if (!userState[senderId]) {
      userState[senderId] = { step: "start" };
    }

    const reply = generateReply(messageText, senderId);
    await sendMessage(senderId, reply);
  }

  res.sendStatus(200);
});

// =====================
// MAIN BRAIN
// =====================
function generateReply(text, userId) {
  const msg = text.toLowerCase();

  if (!userState[userId]) {
    userState[userId] = { step: "start" };
  }

  const state = userState[userId];

  // STEP 1: greeting
  if (state.step === "start") {
    state.step = "asked_interest";

    return `Hi 👋 Welcome to ${academy.name || "AI Academy Asia"}!

What are you interested in?
👉 AI
👉 Programming
👉 Automation`;
  }

  // STEP 2: interest
  if (state.step === "asked_interest") {
    if (msg.includes("ai")) {
      state.step = "asked_age";
      state.interest = "AI";

      return `Nice 🤖 AI is a great choice!

May I ask your age so I can suggest the right program?`;
    }

    if (msg.includes("programming")) {
      state.step = "asked_age";
      state.interest = "Programming";

      return `Great 💻 Programming is powerful!

How old are you?`;
    }

    if (msg.includes("automation")) {
      state.step = "asked_age";
      state.interest = "Automation";

      return `Awesome ⚙️ Automation is very useful!

How old are you?`;
    }

    return `Please choose one:
👉 AI
👉 Programming
👉 Automation`;
  }

  // STEP 3: age
  if (state.step === "asked_age") {
    const age = parseInt(msg);

    if (isNaN(age)) {
      return `Please enter your age as a number 🙂`;
    }

    state.age = age;
    state.step = "recommend";

    const best = findBestProgram(age, state.interest);

    return `Perfect 👍 Based on your age (${age}) and interest in ${state.interest}, I recommend:

👉 ${best?.name || "Our Program"}
📌 Age: ${best?.age_range || "N/A"}
🧠 Focus: ${best?.focus || "Practical AI learning"}

Would you like more details about this program?`;
  }

  // fallback
  return `Let me help you step by step 👍 What are you interested in?`;
}

// =====================
// PROGRAM MATCHER
// =====================
function findBestProgram(age, interest) {
  const programs = academy.programs || [];

  if (interest === "AI" && age >= 10 && age <= 18) {
    return programs.find(p => p.name.includes("Juniors"));
  }

  if (interest === "AI" && age > 18) {
    return programs.find(p => p.name.includes("Adults"));
  }

  if (interest === "Automation") {
    return programs.find(p => p.name.includes("Company")) || programs[1];
  }

  return programs[0];
}

// =====================
// SEND MESSAGE
// =====================
async function sendMessage(psid, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/me/messages`,
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

// =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});