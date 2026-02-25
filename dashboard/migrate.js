
const { Client } = require('pg');

const connectionString = "postgresql://neondb_owner:npg_QBCYNh9m3Uvc@ep-rapid-snow-ac6jntdp-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require";

async function migrate() {
  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Add columns if they don't exist
    const queries = [
      `ALTER TABLE testnet_node_identity ADD COLUMN IF NOT EXISTS ip_address TEXT;`,
      `ALTER TABLE testnet_node_identity ADD COLUMN IF NOT EXISTS role TEXT;`,
      `ALTER TABLE testnet_node_identity ADD COLUMN IF NOT EXISTS quorum_group INT;`,
      // Ensure existing columns are there (from original script)
      `CREATE TABLE IF NOT EXISTS testnet_node_identity (
        id SERIAL PRIMARY KEY,
        hostname TEXT UNIQUE,
        node_seed TEXT NOT NULL,
        public_key TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );`,
       `CREATE TABLE IF NOT EXISTS testnet_manual_peers (
        ip_address TEXT PRIMARY KEY,
        added_at TIMESTAMP DEFAULT NOW()
      );`
    ];

    for (const query of queries) {
      await client.query(query);
      console.log('Executed:', query);
    }

    console.log('Migration complete');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

migrate();
