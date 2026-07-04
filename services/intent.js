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

  return "ai";
}

module.exports = { detectIntent };