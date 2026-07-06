// services/knowledge.js

const fs = require("fs");
const path = require("path");

function loadJSON(filename) {
  try {
    const filePath = path.join(__dirname, "..", "knowledge", filename);
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.log(`❌ Failed to load ${filename}:`, err.message);
    return null;
  }
}

function getKnowledge() {
  return {
    academy: loadJSON("academy.json"),
    pricing: loadJSON("pricing.json"),
    faq: loadJSON("faq.json"),
    location: loadJSON("location.json"),
    contacts: loadJSON("contacts.json"),
    schedule: loadJSON("schedule.json")
  };
}

module.exports = { getKnowledge };