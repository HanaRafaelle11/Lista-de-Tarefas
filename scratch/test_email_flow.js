import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('1. Fetching a new temporary email from Guerrilla Mail...');
  const resAddr = await fetch('https://www.guerrillamail.com/ajax.php?f=get_email_address');
  const addrData = await resAddr.json();
  const email = addrData.email_addr;
  const sid = addrData.sid_token;
  console.log(`✅ Temporary Email: ${email}`);

  console.log('2. Signing up in Supabase with this email...');
  const { data, error } = await supabase.auth.signUp({
    email,
    password: 'Password123!',
    options: {
      data: { name: 'E2E Email Tester' }
    }
  });

  if (error) {
    console.error('❌ Signup error:', error);
    return;
  }
  console.log(`✅ Signup successful! User ID: ${data.user.id}. Now waiting for email delivery...`);

  // Wait for 15 seconds to allow SMTP to process and deliver the email
  for (let i = 1; i <= 3; i++) {
    console.log(`Waiting... (${i * 5}s / 15s)`);
    await sleep(5000);
  }

  console.log('3. Checking inbox on Guerrilla Mail...');
  const checkUrl = `https://www.guerrillamail.com/ajax.php?f=check_email&seq=0&sid_token=${sid}`;
  const resMail = await fetch(checkUrl);
  const mailData = await resMail.json();

  const list = mailData.list || [];
  console.log(`Found ${list.length} email(s) in inbox.`);

  let confirmed = false;
  for (const mail of list) {
    console.log(`- From: ${mail.mail_from} | Subject: ${mail.mail_subject}`);
    if (mail.mail_subject.toLowerCase().includes('confirm') || mail.mail_from.toLowerCase().includes('supabase') || mail.mail_subject.toLowerCase().includes('cadastro')) {
      confirmed = true;
    }
  }

  if (confirmed) {
    console.log('🟩 SUCCESS: Real confirmation email received in inbox!');
  } else {
    console.log('🟥 FAILED: No confirmation email found in inbox.');
  }
}

run();
