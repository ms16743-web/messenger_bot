const { detectIntent } = require("./intent");
const { updateMemory } = require("./memory");
const { getKnowledge } = require("./knowledge");

const greetingHandler = require("../intents/greeting");
const pricingHandler = require("../intents/pricing");
const programsHandler = require("../intents/programs");
const locationHandler = require("../intents/location");
const aiHandler = require("../intents/ai");

async function router(userId, text) {
  const memory = updateMemory(userId, text);
  const knowledge = getKnowledge();

  let intent = detectIntent(text);
  const previousIntent = memory.lastIntent;

  console.log("User text:", text);
  console.log("Intent:", intent);
  console.log("Previous:", previousIntent);

  if (intent === "unknown" && previousIntent === "pricing") {
    intent = "pricing";
  }

  if (intent === "unknown" && previousIntent === "programs") {
    intent = "programs";
  }

  memory.lastIntent = intent;

  if (intent === "greeting") {
    return greetingHandler(memory, knowledge);
  }

  if (intent === "pricing") {
    return pricingHandler(text, memory, knowledge);
  }

  if (intent === "programs") {
    return programsHandler(memory, knowledge, text);
  }

  if (intent === "location") {
    return locationHandler(memory, knowledge);
  }

  return await aiHandler(text, memory, knowledge);
}

module.exports = { router };