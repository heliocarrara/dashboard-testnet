
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_QBCYNh9m3Uvc@ep-rapid-snow-ac6jntdp-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require",
});

export default pool;
