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

  const previousIntent = memory.lastIntent;
  const intent = await detectIntent(text);

  console.log("Detected intent:", intent);
  console.log("Previous intent:", previousIntent);

  if (previousIntent === "pricing") {
    const pricingReply = pricingHandler(text, memory, knowledge);
    memory.lastIntent = "pricing";
    return pricingReply;
  }

  memory.lastIntent = intent;

  if (intent === "greeting") {
    return greetingHandler(memory, knowledge);
  }

  if (intent === "pricing") {
    return pricingHandler(text, memory, knowledge);
  }

  if (intent === "programs") {
    return programsHandler(memory, knowledge);
  }

  if (intent === "location") {
    return locationHandler(memory, knowledge);
  }

  return await aiHandler(text, memory, knowledge);
}

module.exports = { router };