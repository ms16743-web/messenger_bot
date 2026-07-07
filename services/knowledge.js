const fs = require("fs");
const path = require("path");

function getKnowledge() {
  try {
    const filePath = path.join(__dirname, "..", "knowledge", "academy.json");
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.log("❌ Failed to load academy.json:", err.message);
    return {
      programs: [],
      contact: {
        phone: "+976 75051055"
      }
    };
  }
}

module.exports = { getKnowledge };

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