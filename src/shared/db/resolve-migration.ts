import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Resolve a failed migration by marking it as rolled back or applied
 * @param migrationName - The name of the migration to resolve (e.g., '20250120000000_add_credit_card_closing_day_and_linked_account')
 * @param action - 'rolled-back' or 'applied'
 */
export async function resolveMigration(
  migrationName: string,
  action: 'rolled-back' | 'applied' = 'rolled-back'
): Promise<void> {
  try {
    console.log(`🔄 Resolving migration "${migrationName}" as ${action}...`);
    
    const command = `npx prisma migrate resolve --${action} ${migrationName}`;
    const { stdout, stderr } = await execAsync(command);
    
    if (stdout) {
      console.log(stdout);
    }
    
    if (stderr) {
      console.warn('⚠️  Migration resolve warnings:', stderr);
    }
    
    console.log(`✅ Migration "${migrationName}" resolved successfully as ${action}`);
  } catch (error) {
    console.error(`❌ Failed to resolve migration "${migrationName}":`, error);
    throw error;
  }
}

/**
 * List failed migrations in the database
 */
export async function listFailedMigrations(): Promise<string[]> {
  try {
    console.log('🔍 Checking for failed migrations...');
    
    // Try to run migrate deploy to see if there are failed migrations
    const { stderr } = await execAsync('npx prisma migrate deploy', {
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
    });
    
    // If there are no failed migrations, this will succeed or show "Already up to date"
    if (stderr && stderr.includes('failed migrations')) {
      // Extract migration names from the error message
      const migrationMatch = stderr.match(/`([^`]+)` migration.*failed/);
      if (migrationMatch) {
        return [migrationMatch[1]];
      }
    }
    
    return [];
  } catch (error: any) {
    // If migrate deploy fails with P3009, extract the migration name
    if (error.stderr && error.stderr.includes('P3009')) {
      const migrationMatch = error.stderr.match(/`([^`]+)` migration.*failed/);
      if (migrationMatch) {
        return [migrationMatch[1]];
      }
    }
    // If no failed migrations, return empty array
    return [];
  }
}

/**
 * Auto-resolve known failed migrations that are safe to roll back
 * This is useful for migrations that failed because they were already applied
 * or because the schema already has the changes
 */
export async function autoResolveFailedMigrations(): Promise<void> {
  try {
    const failedMigrations = await listFailedMigrations();
    
    if (failedMigrations.length === 0) {
      console.log('✅ No failed migrations found');
      return;
    }
    
    console.log(`⚠️  Found ${failedMigrations.length} failed migration(s):`, failedMigrations);
    
    // Known migrations that can be safely rolled back (e.g., if changes already exist in init migration)
    const safeToRollback = [
      '20250120000000_add_credit_card_closing_day_and_linked_account',
    ];
    
    for (const migration of failedMigrations) {
      if (safeToRollback.includes(migration)) {
        console.log(`🔄 Auto-resolving "${migration}" as rolled-back (changes already in init migration)...`);
        await resolveMigration(migration, 'rolled-back');
      } else {
        console.warn(`⚠️  Migration "${migration}" needs manual resolution.`);
        console.warn(`   Run: npx prisma migrate resolve --rolled-back ${migration}`);
        console.warn(`   Or:  npx prisma migrate resolve --applied ${migration}`);
      }
    }
  } catch (error) {
    console.error('❌ Failed to auto-resolve migrations:', error);
    throw error;
  }
}

