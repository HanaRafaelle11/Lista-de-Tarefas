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
    console.log('Logged in. User ID:', userId);

    console.log('--- Cleaning up existing ---');
    await supabase.from('user_achievements').delete().eq('user_id', userId);

    console.log('--- Inserting ---');
    const { error: insErr } = await supabase.from('user_achievements').insert([{
      user_id: userId,
      achievement_key: 'first_task',
      seen: false
    }]);
    console.log('Insert Error:', insErr);

    console.log('--- Querying before update ---');
    const { data: before } = await supabase.from('user_achievements').select('*').eq('user_id', userId);
    console.log('Before update:', before);

    console.log('--- Updating seen = true ---');
    const { error: updErr } = await supabase.from('user_achievements')
      .update({ seen: true, viewed_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('achievement_key', 'first_task');
    console.log('Update Error:', updErr);

    console.log('--- Querying after update ---');
    const { data: after } = await supabase.from('user_achievements').select('*').eq('user_id', userId);
    console.log('After update:', after);
    
    // Clean up
    await supabase.from('user_achievements').delete().eq('user_id', userId);
  } catch (err) {
    console.error('Test error:', err);
  }
}
run();
