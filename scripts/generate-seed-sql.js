// Generates scripts/init-knowledge.sql from knowledge/academy.json so the
// initial data can be applied with psql on a host that can reach the DB:
//   psql "$DATABASE_URL" -f scripts/init-knowledge.sql
const fs = require("fs");
const path = require("path");

const jsonPath = path.join(__dirname, "..", "knowledge", "academy.json");
const outPath = path.join(__dirname, "init-knowledge.sql");

const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
// Escape single quotes for a Postgres string literal.
const jsonLiteral = JSON.stringify(data, null, 2).replace(/'/g, "''");

const sql = `-- Initial knowledge data for AI Academy Asia messenger bot.
-- Generated from knowledge/academy.json by scripts/generate-seed-sql.js.
-- Apply with: psql "<connection>" -f scripts/init-knowledge.sql

CREATE TABLE IF NOT EXISTS knowledge (
  id         INTEGER PRIMARY KEY DEFAULT 1,
  data       JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_single_row CHECK (id = 1)
);

INSERT INTO knowledge (id, data, updated_at)
VALUES (1, '${jsonLiteral}'::jsonb, now())
ON CONFLICT (id) DO UPDATE
  SET data = EXCLUDED.data, updated_at = now();
`;

fs.writeFileSync(outPath, sql, "utf8");
console.log(`✅ Wrote ${path.relative(path.join(__dirname, ".."), outPath)}`);
