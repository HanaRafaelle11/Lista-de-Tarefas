const fs = require('fs'); 
const lines = fs.readFileSync('C:/Users/rafox/.gemini/antigravity-ide/brain/9472c823-f709-42b1-acdc-6e5b43025d88/.system_generated/logs/transcript.jsonl', 'utf-8').split('\n'); 
const step = lines.find(l => l.includes('"step_index":267')); 
if(step) console.log(JSON.parse(step).content);
