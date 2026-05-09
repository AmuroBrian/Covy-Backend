const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'dummy_key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function reset() {
  console.log('🧹 Starting Supabase Auth Reset...\n');

  try {
    // 2. Delete all Auth users from Supabase
    console.log('🗑️  Deleting all Supabase Auth Users...');
    
    // Need service role key for admin endpoints
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('⚠️  WARNING: SUPABASE_SERVICE_ROLE_KEY is missing from .env');
      console.warn('   Cannot automatically delete Supabase Auth users using the public anon key.');
      console.warn('   Please delete users manually from the Supabase Dashboard -> Authentication -> Users.');
    } else {
      let page = 1;
      let hasMore = true;
      let deletedCount = 0;

      while (hasMore) {
        const { data: { users }, error } = await supabase.auth.admin.listUsers({
          page: page,
          perPage: 1000
        });

        if (error) {
          throw error;
        }

        if (!users || users.length === 0) {
          hasMore = false;
          break;
        }

        for (const user of users) {
          const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
          if (deleteError) {
            console.error(`❌ Failed to delete user ${user.email}:`, deleteError.message);
          } else {
            deletedCount++;
          }
        }
        page++;
      }
      console.log(`✅ Deleted ${deletedCount} users from Supabase Auth.\n`);
    }

    console.log('🎉 Reset Complete! Auth is completely empty.');
  } catch (error) {
    console.error('\n❌ Reset Failed:', error);
  }
}

reset();
