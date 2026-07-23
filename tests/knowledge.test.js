// Lightweight tests (no framework) for the DB-backed knowledge loader.
// Run with: node tests/knowledge.test.js
const assert = require("assert");
const { pool } = require("../services/db");

let passed = 0;
async function test(name, fn) {
  // Reset the in-memory cache between tests by clearing the module cache.
  delete require.cache[require.resolve("../services/knowledge")];
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.error(`❌ ${name}\n   ${error.message}`);
    process.exitCode = 1;
  }
}

async function main() {
  // 1. Loads from DB when a row exists.
  await test("returns knowledge from DB when row exists", async () => {
    const dbDoc = { name: "FromDB", programs: [{ id: "x" }], contact: { phone: "1" } };
    pool.query = async () => ({ rows: [{ data: dbDoc }] });
    const { getKnowledge } = require("../services/knowledge");
    const result = await getKnowledge();
    assert.strictEqual(result.name, "FromDB");
    assert.strictEqual(result.programs.length, 1);
  });

  // 2. Falls back to the bundled JSON file when the DB query fails.
  await test("falls back to academy.json when DB query throws", async () => {
    pool.query = async () => {
      throw new Error("connection refused");
    };
    const { getKnowledge } = require("../services/knowledge");
    const result = await getKnowledge();
    // academy.json has a name and a non-empty programs array.
    assert.ok(result.name, "expected a name from the file");
    assert.ok(Array.isArray(result.programs) && result.programs.length > 0);
    assert.ok(result.contact && result.contact.phone);
  });

  // 3. Falls back to file when the DB returns no rows.
  await test("falls back to file when DB has no knowledge row", async () => {
    pool.query = async () => ({ rows: [] });
    const { getKnowledge } = require("../services/knowledge");
    const result = await getKnowledge();
    assert.ok(Array.isArray(result.programs) && result.programs.length > 0);
  });

  // 4. Caches the result — the DB is only queried once within the TTL.
  await test("caches result and does not re-query within TTL", async () => {
    let calls = 0;
    const dbDoc = { name: "Cached", programs: [], contact: { phone: "1" } };
    pool.query = async () => {
      calls++;
      return { rows: [{ data: dbDoc }] };
    };
    const { getKnowledge } = require("../services/knowledge");
    await getKnowledge();
    await getKnowledge();
    await getKnowledge();
    assert.strictEqual(calls, 1, `expected 1 DB call, got ${calls}`);
  });

  console.log(`\n${passed}/4 tests passed`);
  await pool.end();
}

main();
