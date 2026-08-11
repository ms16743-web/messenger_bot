require("dotenv").config();

const express = require("express");
const axios = require("axios");
const { router } = require("./services/router");
const { connectRedis } = require("./services/memory");
const { checkDb } = require("./services/db");
const { initSemanticCache } = require("./services/semantic");
const app = express();

app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;

const PORT = process.env.PORT || 3000;

const messageBuffers = new Map();
const MESSAGE_DELAY = 3000;

app.get("/", (req, res) => {
  res.status(200).send("AI Academy Messenger bot is running.");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Bot server is healthy",
  });
});

const path = require("path");

app.get("/privacy-policy", (req, res) => {
  res.sendFile(path.join(__dirname, "privacy-policy.html"));
});

app.get("/instagram/callback", (req, res) => {
  console.log("Instagram OAuth callback hit:", req.query);
  res.status(200).send("Login successful. You can close this window.");
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("Webhook verification request received.");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified successfully.");
    return res.status(200).send(challenge);
  }

  console.log("Webhook verification failed.");
  return res.sendStatus(403);
});

app.post("/webhook", (req, res) => {
  res.sendStatus(200);

  console.log("RAW WEBHOOK BODY:", JSON.stringify(req.body));

  try {
    const platform = req.body.object; // "page" (Messenger) or "instagram"
    const entries = req.body.entry || [];

    for (const entry of entries) {
      const messagingEvents = entry.messaging || [];

      for (const event of messagingEvents) {
        if (!event.message) continue;
        if (event.message.is_echo) continue;

        const senderId = event.sender?.id;
        const messageText = event.message?.text?.trim();

        if (!senderId || !messageText) continue;

        console.log(`Received ${platform} message:`, messageText);

        addMessageToBuffer(senderId, messageText, platform);
      }
    }
  } catch (error) {
    console.error("Webhook processing error:", error.message);
  }
});

function addMessageToBuffer(senderId, messageText, platform) {
  let userBuffer = messageBuffers.get(senderId);

  if (!userBuffer) {
    userBuffer = {
      messages: [],
      timer: null,
      platform,
    };

    messageBuffers.set(senderId, userBuffer);
  }

  userBuffer.messages.push(messageText);
  userBuffer.platform = platform;

  if (userBuffer.timer) {
    clearTimeout(userBuffer.timer);
  }

  userBuffer.timer = setTimeout(async () => {
    const combinedMessage = userBuffer.messages.join("\n");
    const messagePlatform = userBuffer.platform;

    messageBuffers.delete(senderId);

    console.log("Combined message:", combinedMessage);

    await showTypingIndicator(senderId, messagePlatform);

    try {
      const { reply, truncated } = await router(senderId, combinedMessage);

      if (!reply) {
        console.log("Router returned an empty response.");
        return;
      }

      await sendMessage(senderId, reply, messagePlatform);

      if (truncated) {
        setTimeout(async () => {
          await sendMessage(
            senderId,
            "Уучлаарай, өмнөх зурвас дутуу орсон байж магадгүй 🙏 Танд нэмэлт асуулт байвал чөлөөтэй бичээрэй.",
            messagePlatform
          );
        }, 2500);
      }
    } catch (error) {
      console.error("Bot response error:", error.message);

      await sendMessage(
        senderId,
        "Уучлаарай, одоогоор таны асуултад хариулах боломжгүй байна. Дэлгэрэнгүй мэдээллийг +976 75051055 дугаараас аваарай.",
        messagePlatform
      );
    }
  }, MESSAGE_DELAY);
}

async function showTypingIndicator(recipientId, platform = "page") {
  const isInstagram = platform === "instagram";
  const url = isInstagram
    ? "https://graph.instagram.com/v21.0/me/messages"
    : "https://graph.facebook.com/v19.0/me/messages";
  const accessToken = isInstagram ? IG_ACCESS_TOKEN : PAGE_ACCESS_TOKEN;

  if (!accessToken) return;

  try {
    await axios.post(
      url,
      {
        recipient: { id: recipientId },
        sender_action: "typing_on",
      },
      {
        params: { access_token: accessToken },
        timeout: 5000,
      }
    );
  } catch (error) {
    console.error(`Typing indicator error (${platform}):`, error.response?.data || error.message);
  }
}

async function sendMessage(recipientId, text, platform = "page") {
  const isInstagram = platform === "instagram";
  const url = isInstagram
    ? "https://graph.instagram.com/v21.0/me/messages"
    : "https://graph.facebook.com/v19.0/me/messages";
  const accessToken = isInstagram ? IG_ACCESS_TOKEN : PAGE_ACCESS_TOKEN;

  if (!accessToken) {
    console.error(`Access token missing for platform: ${platform}`);
    return;
  }

  if (typeof text !== "string" || !text.trim()) {
    console.error("sendMessage got invalid text:", typeof text, JSON.stringify(text));
    return;
  }

  if (!recipientId) {
    console.error("Recipient ID is missing.");
    return;
  }

  try {
    await axios.post(
      url,
      {
        recipient: {
          id: recipientId,
        },
        messaging_type: "RESPONSE",
        message: {
          text,
        },
      },
      {
        params: {
          access_token: accessToken,
        },
        timeout: 10000,
      }
    );

    console.log(`Message sent successfully via ${platform}.`);
  } catch (error) {
    console.error(
      `Messenger/Instagram send error (${platform}):`,
      error.response?.data || error.message
    );
  }
}

async function startServer() {
  try {
    await connectRedis();

    try {
      await checkDb();
      console.log("✅ Postgres connected successfully.");
    } catch (error) {
      console.error("⚠️ Postgres not reachable, knowledge will fall back to file:", error.message);
    }

    await initSemanticCache(); // ← new line

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();