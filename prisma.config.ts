import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Use a dummy URL for build/generate if DATABASE_URL is not set
const databaseUrl = process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost:5432/dummy';

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: databaseUrl,
  },
});

