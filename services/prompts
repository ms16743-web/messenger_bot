// services/prompt.js

const fs = require("fs");
const path = require("path");

function loadText(filename) {
  try {
    const filePath = path.join(__dirname, "..", "prompts", filename);
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    console.log(`❌ Failed to load ${filename}:`, err.message);
    return "";
  }
}

function loadPrompt() {
  return {
    system: loadText("system.txt"),
    tone: loadText("tone.txt"),
    sales: loadText("sales.txt")
  };
}

module.exports = { loadPrompt };