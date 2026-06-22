import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const logFile = path.resolve('.tunnel_log.log');
const urlFile = path.resolve('.tunnel_url');

// Clean previous files
if (fs.existsSync(urlFile)) fs.unlinkSync(urlFile);
if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

console.log("Starting localtunnel on port 5173...");
const lt = spawn('npx', ['localtunnel', '--port', '5173'], {
  shell: true,
  detached: true,
  stdio: 'pipe'
});

lt.stdout.on('data', (data) => {
  const output = data.toString();
  fs.appendFileSync(logFile, output);
  
  const match = output.match(/your url is:\s*(https:\/\/[^\s]+)/);
  if (match) {
    const url = match[1];
    console.log(`\n=============================================`);
    console.log(`🚀 Public Tunnel URL: ${url}`);
    console.log(`=============================================\n`);
    fs.writeFileSync(urlFile, url);
  }
});

lt.stderr.on('data', (data) => {
  fs.appendFileSync(logFile, data.toString());
});

lt.on('close', (code) => {
  console.log(`localtunnel process exited with code ${code}`);
});

// Let it run in background
lt.unref();

console.log("Waiting for tunnel URL to be generated...");
setTimeout(() => {
  if (fs.existsSync(urlFile)) {
    console.log("Tunnel URL generated successfully! Exiting parent process.");
    process.exit(0);
  } else {
    console.log("Tunnel URL not generated yet. Still waiting in background...");
    process.exit(0);
  }
}, 5000);
