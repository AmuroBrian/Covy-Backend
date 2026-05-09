const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const prisma = new PrismaClient();

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
  console.log('🧹 Starting Full Database Reset...\n');

  try {
    // 1. Delete all relational data from PostgreSQL (Prisma)
    console.log('🗑️  Deleting all PostgreSQL records...');
    await prisma.notification.deleteMany();
    await prisma.chatMessage.deleteMany();
    await prisma.chatReadReceipt.deleteMany();
    await prisma.checklistItem.deleteMany();
    await prisma.checklist.deleteMany();
    await prisma.goal.deleteMany();
    await prisma.expense.deleteMany();
    await prisma.budget.deleteMany();
    await prisma.savedPlace.deleteMany();
    await prisma.locationHistory.deleteMany();
    await prisma.statusUpdate.deleteMany();
    await prisma.device.deleteMany();
    await prisma.healthMetric.deleteMany();
    
    // Core user data
    await prisma.user.deleteMany();
    await prisma.couple.deleteMany();
    console.log('✅ PostgreSQL records deleted.\n');

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

    console.log('🎉 Reset Complete! The database is completely empty.');
  } catch (error) {
    console.error('\n❌ Reset Failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

reset();
