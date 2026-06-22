import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const examplePath = path.resolve('.env.example');

const publicKey = 'BPE15kzXwmrFN2wLkTDKDhOrCurYdLHsvESaKEDCVuQq2_j7fWhVYA1jK9uXoY5l_eLBCnkzsEIEW-L-rgy6d3g';
const privateKey = '3vNvdv_O-FSgp2FBMgZq2GZH6MjIh4f7otjp-9h1ocI';

if (fs.existsSync(envPath)) {
  let content = fs.readFileSync(envPath, 'utf8');
  if (!content.includes('VITE_PUBLIC_VAPID_KEY')) {
    content += `\nVITE_PUBLIC_VAPID_KEY=${publicKey}\nPRIVATE_VAPID_KEY=${privateKey}\n`;
    fs.writeFileSync(envPath, content);
    console.log('✅ Added VAPID keys to .env.local');
  } else {
    console.log('ℹ️ VAPID keys already exist in .env.local');
  }
}

if (fs.existsSync(examplePath)) {
  let content = fs.readFileSync(examplePath, 'utf8');
  if (!content.includes('VITE_PUBLIC_VAPID_KEY')) {
    content += `\nVITE_PUBLIC_VAPID_KEY=SUA_PUBLIC_KEY_AQUI\nPRIVATE_VAPID_KEY=SUA_PRIVATE_KEY_AQUI\n`;
    fs.writeFileSync(examplePath, content);
    console.log('✅ Added placeholders to .env.example');
  }
}
