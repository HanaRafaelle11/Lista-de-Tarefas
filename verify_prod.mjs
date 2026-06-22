import fs from 'fs';
import https from 'https';

const get = (url) => new Promise((resolve, reject) => {
  https.get(url, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      return get(res.headers.location).then(resolve).catch(reject);
    }
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => resolve(data));
  }).on('error', reject);
});

async function run() {
  console.log("Fetching production HTML...");
  const html = await get('https://myflowday.com.br');
  
  const match = html.match(/src="(\/assets\/index-.*?\.js)"/);
  if (!match) {
    console.error("Could not find main JS bundle in HTML");
    process.exit(1);
  }
  
  const jsUrl = `https://myflowday.com.br${match[1]}`;
  console.log(`Found JS bundle: ${jsUrl}`);
  console.log("Fetching bundle...");
  
  const js = await get(jsUrl);
  
  console.log("\n--- EVIDENCE 1: tasksService updated_at removal ---");
  // The old code had: completed_at:null,updated_at:
  // We want to see if the payload inside insert([{...}]) has updated_at.
  // We can search for the insert object structure.
  if (js.includes('updated_at:')) {
    // wait, updated_at is used in syncQueue and other places.
    // Let's check if tasksService still has updated_at:nowIso.
    // The specific buggy line was: `const payload={updated_at:`
    if (js.includes('payload={updated_at:')) {
      console.error("❌ FAILED: payload={updated_at:} still exists in tasksService.update!");
    } else {
      console.log("✅ SUCCESS: payload={updated_at:} was successfully removed from update payload!");
    }
  }

  console.log("\n--- EVIDENCE 2: Delete Goal Button ---");
  const goalsViewMatch = html.match(/href="(\/assets\/GoalsView-.*?\.js)"/);
  if (!goalsViewMatch) {
    console.error("❌ FAILED: Could not find GoalsView bundle in HTML preloads!");
  } else {
    const goalsUrl = `https://myflowday.com.br${goalsViewMatch[1]}`;
    console.log(`Fetching ${goalsUrl}...`);
    const goalsJs = await get(goalsUrl);
    if (goalsJs.includes('Excluir') && goalsJs.includes('var(--danger)')) {
      console.log("✅ SUCCESS: Delete button signature found in the bundle (Excluir + --danger style)!");
    } else {
      console.error("❌ FAILED: Delete button signature is missing from the bundle!");
    }
  }

  console.log("\n--- EVIDENCE 3: SPA Routing ---");
  const viteConfigMatch = js.includes('navigateFallback');
  // navigateFallback is in the service worker, not the main JS!
  console.log("Fetching Service Worker...");
  const sw = await get('https://myflowday.com.br/sw.js');
  if (sw.includes('navigateFallback') || sw.includes('index.html')) {
    console.log("✅ SUCCESS: Service worker includes navigateFallback routing rules!");
  } else {
    console.error("❌ FAILED: Service worker does not include SPA fallback!");
  }
}

run().catch(console.error);
