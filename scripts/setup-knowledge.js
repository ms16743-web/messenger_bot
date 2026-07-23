require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { pool } = require("../services/db");

// Creates the `knowledge` table (a single JSONB document) and seeds it from
// knowledge/academy.json. Safe to re-run: it upserts the same row.
async function main() {
  const filePath = path.join(__dirname, "..", "knowledge", "academy.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

  await pool.query(`
    CREATE TABLE IF NOT EXISTS knowledge (
      id INTEGER PRIMARY KEY DEFAULT 1,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT knowledge_single_row CHECK (id = 1)
    );
  `);

  await pool.query(
    `
    INSERT INTO knowledge (id, data, updated_at)
    VALUES (1, $1, now())
    ON CONFLICT (id) DO UPDATE
      SET data = EXCLUDED.data, updated_at = now();
    `,
    [data]
  );

  const { rows } = await pool.query(
    "SELECT jsonb_array_length(data->'programs') AS programs, updated_at FROM knowledge WHERE id = 1"
  );

  console.log("✅ Knowledge seeded into Postgres.");
  console.log(`   programs: ${rows[0].programs}, updated_at: ${rows[0].updated_at}`);
}

main()
  .catch((error) => {
    console.error("❌ Setup failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
