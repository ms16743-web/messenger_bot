const fs = require("fs");
const path = require("path");

function getKnowledge() {
  try {
    const filePath = path.join(
      __dirname,
      "..",
      "knowledge",
      "academy.json"
    );

    const file = fs.readFileSync(filePath, "utf8");
    return JSON.parse(file);
  } catch (error) {
    console.log("❌ Knowledge loading error:", error.message);

    return {
      programs: [],
      contact: {
        phone: "+976 75051055"
      }
    };
  }
}

module.exports = { getKnowledge };