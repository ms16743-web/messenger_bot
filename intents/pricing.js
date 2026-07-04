// intents/pricing.js

function pricingHandler(memory) {
  if (memory.language === "mn") {
    return "Сургалтын төлбөр хөтөлбөрөөс хамаарна. Одоогоор та Juniors, Adults, эсвэл Company Training-ийн үнийг асууж болно. Аль хөтөлбөр сонирхож байна вэ?";
  }

  return "Tuition depends on the program. You can ask about Juniors, Adults, or Company Training. Which program are you interested in?";
}

module.exports = pricingHandler;