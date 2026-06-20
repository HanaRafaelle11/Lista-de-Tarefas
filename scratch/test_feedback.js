import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFeedback() {
  console.log('Invoking Edge Function send-feedback-email directly...');
  try {
    const { data, error } = await supabase.functions.invoke('send-feedback-email', {
      body: {
        message: 'Teste de auditoria de feedback do Antigravity AI (Unauthenticated)',
        userId: 'a937a097-4001-4475-b461-1d5ce5a3068e',
        userEmail: 'test-verify-1781992241218@gmail.com'
      }
    });
    
    if (error) {
      console.error('Edge Function returned error:', error);
      if (error.message) {
        console.error('Error message:', error.message);
      }
      try {
        const text = await error.context.text();
        console.error('Error response body:', text);
      } catch (e) {}
    } else {
      console.log('Edge Function success! Response data:', data);
    }
  } catch (err) {
    console.error('Unexpected error invoking Edge Function:', err);
  }
}

testFeedback();
