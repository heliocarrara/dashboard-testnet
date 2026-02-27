
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_QBCYNh9m3Uvc@ep-rapid-snow-ac6jntdp-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require",
});

const SDF_NODES = [
  {
    hostname: 'sdf-testnet-1',
    ip_address: 'core-live-testnet-1.stellar.org',
    public_key: 'GDKXE2OZMJIPOSLNA6N6F2BVCI3O777I2OOC4BV7VOYUEHYX7RTRYA7Y',
    role: 'validator_sdf',
    node_seed: 'SDFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
  },
  {
    hostname: 'sdf-testnet-2',
    ip_address: 'core-live-testnet-2.stellar.org',
    public_key: 'GCUCJTIUXO4RYQ6LUCNYE1M7LS4H3TP36FX5LHURFC47XXCNBAD5SS9G',
    role: 'validator_sdf',
    node_seed: 'SDFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
  },
  {
    hostname: 'sdf-testnet-3',
    ip_address: 'core-live-testnet-3.stellar.org',
    public_key: 'GAC1991C0D9N9024D6S527479F296062758362391033285906752044',
    role: 'validator_sdf',
    node_seed: 'SDFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
  }
];

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Starting migration...');
    
    // 1. Create node_relationships table
    await client.query(`
      CREATE TABLE IF NOT EXISTS node_relationships (
        id SERIAL PRIMARY KEY,
        source_node_id INTEGER REFERENCES testnet_node_identity(id),
        target_node_id INTEGER REFERENCES testnet_node_identity(id),
        UNIQUE(source_node_id, target_node_id)
      );
    `);
    console.log('Created node_relationships table.');

    // 2. Insert SDF nodes
    for (const node of SDF_NODES) {
      const res = await client.query(`
        SELECT id FROM testnet_node_identity WHERE public_key = $1
      `, [node.public_key]);

      if (res.rowCount === 0) {
        await client.query(`
          INSERT INTO testnet_node_identity (hostname, ip_address, public_key, role, status, config_status, quorum_group, created_at, node_seed)
          VALUES ($1, $2, $3, $4, 'online', 'configured', 0, NOW(), $5)
        `, [node.hostname, node.ip_address, node.public_key, node.role, node.node_seed]);
        console.log(`Inserted SDF node: ${node.hostname}`);
      } else {
        // Update IP/Hostname if needed
        await client.query(`
            UPDATE testnet_node_identity 
            SET hostname = $1, ip_address = $2, role = $4, node_seed = $5
            WHERE public_key = $3
        `, [node.hostname, node.ip_address, node.public_key, node.role, node.node_seed]);
        console.log(`Updated SDF node: ${node.hostname}`);
      }
    }

    // 3. Clear existing relationships
    await client.query('DELETE FROM node_relationships');
    console.log('Cleared existing relationships.');

    // 4. Get all nodes
    const localValidatorsRes = await client.query("SELECT id, hostname FROM testnet_node_identity WHERE role = 'validator' ORDER BY id");
    const sdfValidatorsRes = await client.query("SELECT id, hostname FROM testnet_node_identity WHERE role = 'validator_sdf' ORDER BY id");
    const watchersRes = await client.query("SELECT id, hostname FROM testnet_node_identity WHERE role LIKE 'watcher%' ORDER BY id");

    const localValidators = localValidatorsRes.rows;
    const sdfValidators = sdfValidatorsRes.rows;
    const watchers = watchersRes.rows;

    console.log(`Found ${localValidators.length} local validators, ${sdfValidators.length} SDF validators, ${watchers.length} watchers.`);

    if (localValidators.length === 0) {
      console.log('No local validators found. Skipping relationship creation.');
      return;
    }

    // 5. Create relationships for Local Validators
    // Each connects to 3 other local validators + 2 SDF validators
    for (let i = 0; i < localValidators.length; i++) {
      const source = localValidators[i];
      
      // Select 3 other local validators (Round Robin)
      const peers = [];
      for (let j = 1; j <= 3; j++) {
        const peerIndex = (i + j) % localValidators.length;
        if (localValidators[peerIndex].id !== source.id) { // Should always be true if length > 3
             peers.push(localValidators[peerIndex]);
        }
      }
      
      // Select 2 SDF validators (Round Robin)
      const sdfPeers = [];
      for (let j = 0; j < 2; j++) {
        const sdfIndex = (i + j) % sdfValidators.length;
        sdfPeers.push(sdfValidators[sdfIndex]);
      }

      // Insert
      for (const p of [...peers, ...sdfPeers]) {
        await client.query(`
          INSERT INTO node_relationships (source_node_id, target_node_id)
          VALUES ($1, $2)
        `, [source.id, p.id]);
      }
      console.log(`Assigned peers for ${source.hostname}: ${peers.map(p=>p.hostname).join(', ')} + ${sdfPeers.map(p=>p.hostname).join(', ')}`);
    }

    // 6. Create relationships for Watchers
    // Connect to ALL local validators + ALL SDF validators
    for (const watcher of watchers) {
      const allValidators = [...localValidators, ...sdfValidators];
      for (const v of allValidators) {
        await client.query(`
          INSERT INTO node_relationships (source_node_id, target_node_id)
          VALUES ($1, $2)
        `, [watcher.id, v.id]);
      }
      console.log(`Assigned all validators to watcher ${watcher.hostname}`);
    }

    console.log('Migration completed successfully.');

  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
