const { Pool } = require("pg");

// The password contains special characters, so we configure the pool with
// discrete fields instead of a connection string to avoid URL-encoding issues.
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT) || 5432,
  // AWS RDS requires SSL; we don't ship the RDS CA bundle, so accept the
  // server certificate without verifying the chain.
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
});

pool.on("error", (error) => {
  console.error("Postgres pool error:", error.message);
});

// Non-fatal connectivity check for startup logging. The app still runs if the
// DB is unreachable because knowledge loading falls back to the JSON file.
async function checkDb() {
  const result = await pool.query("SELECT 1");
  return result.rowCount === 1;
}

module.exports = { pool, checkDb };
