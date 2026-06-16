import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { goalsService } from '../src/services/goalsService.js';

// Setup Supabase globally for imports to work
const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseAnonKey = keyMatch[1].trim();

// Mock global supabase client that is used in goalsService
import { supabase } from '../src/supabaseClient.js';

async function run() {
  try {
    const testEmail = 'teste@flowday.app';
    const testPassword = 'Password123!';
    const loginRes = await supabase.auth.signInWithPassword({ email: testEmail, password: testPassword });
    if (loginRes.error) throw loginRes.error;
    const userId = loginRes.data.user.id;
    console.log('Logged in successfully. User ID:', userId);

    console.log('--- Testing goalsService.create ---');
    const { data: createData, error: createError } = await goalsService.create(userId, {
      title: 'Service test goal',
      description: 'Testing service fallback',
      color: '#8A6B8A',
      icon: '🚀',
      target_date: '2026-07-01',
      start_time: '10:00:00',
      end_time: '12:00:00',
    });

    console.log('Create Error:', createError);
    console.log('Create Data:', createData);

    if (createError || !createData) return;

    const goalId = createData.id;

    console.log('--- Testing goalsService.update ---');
    const { data: updateData, error: updateError } = await goalsService.update(userId, goalId, {
      title: 'Service test goal UPDATED',
      target_date: '2026-07-02',
      start_time: '11:00:00',
      end_time: '13:00:00'
    });

    console.log('Update Error:', updateError);
    console.log('Update Data:', updateData);

    console.log('--- Testing goalsService.getAll ---');
    const { data: allData } = await goalsService.getAll(userId);
    const foundGoal = allData.goals.find(g => g.id === goalId);
    console.log('Found Goal in getAll:', foundGoal);

    console.log('--- Clean up ---');
    await goalsService.delete(userId, goalId);
    console.log('Goal deleted.');
  } catch (err) {
    console.error('Test error:', err);
  }
}
run();
