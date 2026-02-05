#!/usr/bin/env tsx

/**
 * CLI script to resolve failed Prisma migrations
 * 
 * Usage:
 *   npm run db:resolve -- --rolled-back <migration_name>
 *   npm run db:resolve -- --applied <migration_name>
 *   npm run db:resolve -- --auto
 */

import 'dotenv/config';
import { resolveMigration, listFailedMigrations, autoResolveFailedMigrations } from './resolve-migration.js';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Usage:
  npm run db:resolve -- --rolled-back <migration_name>
  npm run db:resolve -- --applied <migration_name>
  npm run db:resolve -- --auto
  npm run db:resolve -- --list

Examples:
  npm run db:resolve -- --rolled-back 20250120000000_add_credit_card_closing_day_and_linked_account
  npm run db:resolve -- --applied 20250120000000_add_credit_card_closing_day_and_linked_account
  npm run db:resolve -- --auto
  npm run db:resolve -- --list
`);
    process.exit(0);
  }
  
  if (args[0] === '--list') {
    try {
      const failed = await listFailedMigrations();
      if (failed.length === 0) {
        console.log('✅ No failed migrations found');
      } else {
        console.log('❌ Failed migrations:');
        failed.forEach(migration => {
          console.log(`  - ${migration}`);
        });
      }
    } catch (error) {
      console.error('❌ Error listing failed migrations:', error);
      process.exit(1);
    }
    return;
  }
  
  if (args[0] === '--auto') {
    try {
      await autoResolveFailedMigrations();
    } catch (error) {
      console.error('❌ Error auto-resolving migrations:', error);
      process.exit(1);
    }
    return;
  }
  
  if (args[0] === '--rolled-back' || args[0] === '--applied') {
    const action = args[0].replace('--', '') as 'rolled-back' | 'applied';
    const migrationName = args[1];
    
    if (!migrationName) {
      console.error('❌ Error: Migration name is required');
      console.error(`Usage: npm run db:resolve -- --${action} <migration_name>`);
      process.exit(1);
    }
    
    try {
      await resolveMigration(migrationName, action);
    } catch (error) {
      console.error('❌ Error resolving migration:', error);
      process.exit(1);
    }
    return;
  }
  
  console.error('❌ Unknown option:', args[0]);
  console.error('Run with --help to see usage');
  process.exit(1);
}

main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

