import { exec } from 'child_process';
import { promisify } from 'util';
import { autoResolveFailedMigrations } from './resolve-migration.js';

const execAsync = promisify(exec);

/**
 * Run Prisma migrations
 * Automatically resolves failed migrations if they're safe to roll back
 */
export async function runMigrations(): Promise<void> {
  try {
    console.log('🔄 Running database migrations...');
    
    // Use prisma migrate deploy for production
    const { stdout, stderr } = await execAsync('npx prisma migrate deploy', {
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer for large outputs
    });
    
    if (stdout) {
      console.log(stdout);
    }
    
    if (stderr && !stderr.includes('Already up to date')) {
      console.warn('⚠️  Migration warnings:', stderr);
    }
    
    console.log('✅ Migrations completed successfully');
    
    // Check if fix_income migration was just applied and run balance recompute
    await checkAndRunBalanceRecompute(stdout);
  } catch (error: any) {
    // Check if this is a failed migration error (P3009)
    if (error.stderr && error.stderr.includes('P3009')) {
      console.error('❌ Migration failed: Found failed migrations in database');
      console.log('🔄 Attempting to auto-resolve failed migrations...');
      
      try {
        await autoResolveFailedMigrations();
        console.log('🔄 Retrying migrations after resolution...');
        
        // Retry the migration after resolving
        const { stdout, stderr } = await execAsync('npx prisma migrate deploy', {
          maxBuffer: 1024 * 1024 * 10,
        });
        
        if (stdout) {
          console.log(stdout);
        }
        
        if (stderr && !stderr.includes('Already up to date')) {
          console.warn('⚠️  Migration warnings:', stderr);
        }
        
        console.log('✅ Migrations completed successfully after resolution');
        
        // Check if fix_income migration was just applied and run balance recompute
        await checkAndRunBalanceRecompute(stdout);
        return;
      } catch (resolveError) {
        console.error('❌ Failed to auto-resolve migrations. Manual intervention required.');
        console.error('   Check the migration logs and resolve manually using:');
        console.error('   npx prisma migrate resolve --rolled-back <migration_name>');
        console.error('   or');
        console.error('   npx prisma migrate resolve --applied <migration_name>');
        throw resolveError;
      }
    }
    
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Check if fix_income migration was applied and run balance recompute automatically
 */
async function checkAndRunBalanceRecompute(migrationOutput: string): Promise<void> {
  const FIX_INCOME_MIGRATION = '20260123120000_fix_income_misclassified_as_expense';
  
  // Check if the migration was just applied
  if (!migrationOutput || !migrationOutput.includes(FIX_INCOME_MIGRATION)) {
    return;
  }
  
  try {
    console.log('🔄 Fix income migration detected. Running balance recompute...');
    
    // Run the recompute script - only recalculates balances for affected accounts
    // This ensures we don't touch accounts that weren't affected by the migration
    const { stdout, stderr } = await execAsync('npm run script:recompute-balances', {
      maxBuffer: 1024 * 1024 * 10,
      env: { ...process.env },
      cwd: process.cwd(),
    });
    
    if (stdout) {
      console.log(stdout);
    }
    if (stderr && !stderr.includes('✅') && !stderr.includes('Account balances recomputed')) {
      console.warn('⚠️  Balance recompute warnings:', stderr);
    }
    
    console.log('✅ Balance recompute completed');
  } catch (error: any) {
    // Don't fail the migration if recompute fails - log and continue
    console.error('⚠️  Balance recompute failed (non-fatal):', error?.message || error);
    console.error('   The migration completed successfully.');
    console.error('   You can run balance recompute manually later with: npm run script:recompute-balances');
  }
}

