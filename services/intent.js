// services/intent.js

function detectIntent(text) {
  const msg = text.toLowerCase();

  if (
    msg.includes("hi") ||
    msg.includes("hello") ||
    msg.includes("hey") ||
    msg.includes("сайн") ||
    msg.includes("sain uu") ||
    msg.includes("sn uu")
  ) {
    return "greeting";
  }

  if (
    msg.includes("үнэ") ||
    msg.includes("төлбөр") ||
    msg.includes("price") ||
    msg.includes("cost") ||
    msg.includes("une") ||
    msg.includes("tolbor")
  ) {
    return "pricing";
  }
  if (
    msg.includes("location") ||
    msg.includes("Address") ||
    msg.includes("байршил") ||
    msg.includes("Хаан бэ") ||
    msg.includes("Хаяг") ||
    msg.includes("Location")
  ) {
    return "location";
  }

  return "ai";
}

module.exports = { detectIntent };