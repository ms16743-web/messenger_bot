require("dotenv").config();

const express = require("express");
const axios = require("axios");
const { router } = require("./services/router");
const { connectRedis } = require("./services/memory");
const { checkDb } = require("./services/db");

const app = express();

app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

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
  // Facebook-д webhook хүлээн авсныг шууд мэдэгдэнэ.
  res.sendStatus(200);

  try {
    const entries = req.body.entry || [];

    for (const entry of entries) {
      const messagingEvents = entry.messaging || [];

      for (const event of messagingEvents) {
        if (!event.message) continue;
        if (event.message.is_echo) continue;

        const senderId = event.sender?.id;
        const messageText = event.message?.text?.trim();

        if (!senderId || !messageText) continue;

        console.log("Received message:", messageText);

        addMessageToBuffer(senderId, messageText);
      }
    }
  } catch (error) {
    console.error("Webhook processing error:", error.message);
  }
});

function addMessageToBuffer(senderId, messageText) {
  let userBuffer = messageBuffers.get(senderId);

  if (!userBuffer) {
    userBuffer = {
      messages: [],
      timer: null,
    };

    messageBuffers.set(senderId, userBuffer);
  }

  userBuffer.messages.push(messageText);

  if (userBuffer.timer) {
    clearTimeout(userBuffer.timer);
  }

userBuffer.timer = setTimeout(async () => {
    const combinedMessage = userBuffer.messages.join("\n");

    messageBuffers.delete(senderId);

    console.log("Combined message:", combinedMessage);

    try {
      const { reply, truncated } = await router(senderId, combinedMessage);

      if (!reply) {
        console.log("Router returned an empty response.");
        return;
      }

      await sendMessage(senderId, reply);

      if (truncated) {
        setTimeout(async () => {
          await sendMessage(
            senderId,
            "Уучлаарай, өмнөх зурвас дутуу орсон байж магадгүй 🙏 Танд нэмэлт асуулт байвал чөлөөтэй бичээрэй."
          );
        }, 2500);
      }
    } catch (error) {
      console.error("Bot response error:", error.message);

      await sendMessage(
        senderId,
        "Уучлаарай, одоогоор таны асуултад хариулах боломжгүй байна. Дэлгэрэнгүй мэдээллийг +976 75051055 дугаараас аваарай."
      );
    }
  }, MESSAGE_DELAY);
}

async function sendMessage(psid, text) {
  if (!PAGE_ACCESS_TOKEN) {
    console.error("PAGE_ACCESS_TOKEN is missing.");
    return;
  }

  if (!psid || !text) {
    console.error("Recipient ID or reply text is missing.");
    return;
  }

  try {
    await axios.post(
      "https://graph.facebook.com/v19.0/me/messages",
      {
        recipient: {
          id: psid,
        },
        messaging_type: "RESPONSE",
        message: {
          text,
        },
      },
      {
        params: {
          access_token: PAGE_ACCESS_TOKEN,
        },
        timeout: 10000,
      }
    );

    console.log("Message sent successfully.");
  } catch (error) {
    console.error(
      "Messenger send error:",
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
      console.error(
        "⚠️ Postgres not reachable, knowledge will fall back to file:",
        error.message
      );
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();