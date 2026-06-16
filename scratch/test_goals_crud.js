import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
  try {
    const testEmail = 'teste@flowday.app';
    const testPassword = 'Password123!';
    const loginRes = await supabase.auth.signInWithPassword({ email: testEmail, password: testPassword });
    if (loginRes.error) throw loginRes.error;
    const userId = loginRes.data.user.id;
    console.log('Logged in successfully. User ID:', userId);

    console.log('--- Testing Create ---');
    const { data: createData, error: createError } = await supabase
      .from('goals')
      .insert([{
        user_id: userId,
        title: 'Direct test goal',
        description: 'Testing create',
        color: '#8A6B8A',
        icon: '🚀',
        target_date: '2026-07-01',
        start_time: '10:00:00',
        end_time: '12:00:00',
        status: 'active',
      }])
      .select()
      .single();

    console.log('Create Error:', createError);
    console.log('Create Data:', createData);

    if (createError || !createData) return;

    const goalId = createData.id;

    console.log('--- Testing Update ---');
    const updates = {
      title: 'Direct test goal UPDATED',
      target_date: '2026-07-02',
      start_time: '11:00:00',
      end_time: '13:00:00'
    };
    const { error: updateError } = await supabase
      .from('goals')
      .update(updates)
      .eq('id', goalId)
      .eq('user_id', userId);

    console.log('Update Error:', updateError);

    console.log('--- Verifying ---');
    const { data: dbGoal } = await supabase.from('goals').select('*').eq('id', goalId).single();
    console.log('Goal in DB:', dbGoal);

    console.log('--- Clean up ---');
    await supabase.from('goals').delete().eq('id', goalId);
  } catch (err) {
    console.error('Test error:', err);
  }
}
run();
