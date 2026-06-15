import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function getMailTmDomain() {
  const res = await fetch('https://api.mail.tm/domains');
  const json = await res.json();
  return json['hydra:member'][0].domain;
}

async function createMailTmAccount(email, password) {
  const res = await fetch('https://api.mail.tm/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: email, password })
  });
  return res.json();
}

async function getMailTmToken(email, password) {
  const res = await fetch('https://api.mail.tm/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: email, password })
  });
  const json = await res.json();
  return json.token;
}

async function getMessages(token) {
  const res = await fetch('https://api.mail.tm/messages', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const json = await res.json();
  return json['hydra:member'];
}

async function getMessageSource(token, messageId) {
  const res = await fetch(`https://api.mail.tm/messages/${messageId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return res.json();
}

async function run() {
  try {
    const domain = await getMailTmDomain();
    const username = `flowday-test-${Date.now()}`;
    const email = `${username}@${domain}`;
    const password = 'TestPassword123!';
    
    console.log(`Created temp email: ${email}`);
    await createMailTmAccount(email, password);
    const token = await getMailTmToken(email, password);
    console.log(`Got mail.tm token!`);

    console.log(`Signing up on Supabase...`);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: 'E2E Flowday User' } }
    });
    
    if (error) {
      console.error('Supabase signup error:', error);
      return;
    }
    console.log('Supabase signup successful. Checking for confirmation email...');

    // Poll for the verification email
    let messages = [];
    for (let i = 0; i < 15; i++) {
      console.log(`Polling for emails (attempt ${i + 1}/15)...`);
      messages = await getMessages(token);
      if (messages.length > 0) break;
      await new Promise(r => setTimeout(r, 4000));
    }

    if (messages.length === 0) {
      console.error('Verification email not received.');
      return;
    }

    console.log(`Received ${messages.length} message(s). Fetching details...`);
    const msgDetails = await getMessageSource(token, messages[0].id);
    console.log(`Subject: ${msgDetails.subject}`);
    
    // Extract confirmation link
    const html = msgDetails.html[0];
    const linkMatch = html.match(/href="([^"]+)"/);
    if (!linkMatch) {
      console.error('Could not find confirmation link in email body.');
      // Let's print the HTML to inspect
      console.log(html);
      return;
    }
    
    const confirmationLink = linkMatch[1];
    console.log(`Confirmation link found: ${confirmationLink}`);
    
    // Confirm email by fetching the link
    console.log('Navigating to confirmation link...');
    const confirmRes = await fetch(confirmationLink);
    console.log(`Confirmation response status: ${confirmRes.status}`);
    
    // Check user confirmation status on Supabase
    const { data: { user }, error: userError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (userError) {
      console.error('Failed to log in after confirmation:', userError.message);
    } else {
      console.log('Successfully logged in!', user.email, 'Confirmed at:', user.email_confirmed_at);
    }
  } catch (err) {
    console.error('Error in flow:', err);
  }
}

run();
