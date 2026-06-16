const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => { 
  const [k, ...v] = line.split('='); 
  if(k) acc[k.trim()] = v.join('=').trim().replace(/['"\r]/g, ''); 
  return acc; 
}, {});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.auth.signInWithPassword({ email: 'test@flowday.com', password: 'senha' });
  console.log('test@flowday.com / senha:', error ? error.message : 'Success!');

  const { data: d2, error: e2 } = await supabase.auth.signInWithPassword({ email: 'teste@teste.com', password: 'senha' });
  console.log('teste@teste.com / senha:', e2 ? e2.message : 'Success!');

  const { data: d3, error: e3 } = await supabase.auth.signInWithPassword({ email: 'teste@teste.com', password: '123456'});
  console.log('teste@teste.com / 123456:', e3 ? e3.message : 'Success!');
}
run();
