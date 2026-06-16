import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

if (!urlMatch || !keyMatch) {
  console.error('Credentials missing');
  process.exit(1);
}

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function runSmokeTest() {
  console.log('--- PRODUCTION SMOKE TEST ---');
  let testStatus = {};
  
  try {
    // 1. Login
    console.log('[1/8] Executing: Login...');
    const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
      email: 'teste@flowday.app',
      password: 'Password123!'
    });
    if (loginErr) throw new Error(`Login failed: ${loginErr.message}`);
    const userId = loginData.user.id;
    testStatus['login'] = '✅ PASSED';
    console.log(`  -> Logged in as ${userId}`);

    // 2. Criar Objetivo
    console.log('[2/8] Executing: Criar objetivo...');
    const { data: goalData, error: goalErr } = await supabase.from('goals')
      .insert({ user_id: userId, title: 'Smoke Test Goal', color: '#000000', icon: '🎯' })
      .select();
    if (goalErr) throw new Error(`Create goal failed: ${goalErr.message}`);
    const goalId = goalData[0].id;
    testStatus['criar_objetivo'] = '✅ PASSED';
    console.log(`  -> Goal created: ${goalId}`);

    // 3. Editar Objetivo
    console.log('[3/8] Executing: Editar objetivo...');
    const { error: editGoalErr } = await supabase.from('goals')
      .update({ title: 'Smoke Test Goal Edited' })
      .eq('id', goalId);
    if (editGoalErr) throw new Error(`Edit goal failed: ${editGoalErr.message}`);
    testStatus['editar_objetivo'] = '✅ PASSED';
    console.log(`  -> Goal updated successfully`);

    // 4. Excluir Objetivo
    console.log('[4/8] Executing: Excluir objetivo...');
    const { error: delGoalErr } = await supabase.from('goals')
      .delete()
      .eq('id', goalId);
    if (delGoalErr) throw new Error(`Delete goal failed: ${delGoalErr.message}`);
    testStatus['excluir_objetivo'] = '✅ PASSED';
    console.log(`  -> Goal deleted successfully`);

    // 5. Criar Tarefa
    console.log('[5/8] Executing: Criar tarefa...');
    const { data: taskData, error: taskErr } = await supabase.from('tasks')
      .insert({ user_id: userId, title: 'Smoke Test Task', category: 'Trabalho', priority: 'Média' })
      .select();
    if (taskErr) throw new Error(`Create task failed: ${taskErr.message}`);
    const taskId = taskData[0].id;
    testStatus['criar_tarefa'] = '✅ PASSED';
    console.log(`  -> Task created: ${taskId}`);

    // 6. Concluir Tarefa
    console.log('[6/8] Executing: Concluir tarefa...');
    const { error: compTaskErr } = await supabase.from('tasks')
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq('id', taskId);
    if (compTaskErr) throw new Error(`Complete task failed: ${compTaskErr.message}`);
    testStatus['concluir_tarefa'] = '✅ PASSED';
    console.log(`  -> Task completed successfully`);

    // 7. Refresh (Simulate by fetching the completed task)
    console.log('[7/8] Executing: Refresh (Data re-hydration)...');
    const { data: refetchData, error: refetchErr } = await supabase.from('tasks')
      .select('completed')
      .eq('id', taskId)
      .single();
    if (refetchErr) throw new Error(`Refetch task failed: ${refetchErr.message}`);
    if (!refetchData.completed) throw new Error('Task was not completed on refresh');
    testStatus['refresh'] = '✅ PASSED';
    console.log(`  -> Refresh verified: task is still marked complete`);
    
    // Cleanup the smoke test task
    await supabase.from('tasks').delete().eq('id', taskId);

    // 8. Logout/Login
    console.log('[8/8] Executing: Logout/Login...');
    await supabase.auth.signOut();
    const { error: reloginErr } = await supabase.auth.signInWithPassword({
      email: 'teste@flowday.app',
      password: 'Password123!'
    });
    if (reloginErr) throw new Error(`Re-login failed: ${reloginErr.message}`);
    testStatus['logout_login'] = '✅ PASSED';
    console.log(`  -> Re-login successful`);

    console.log('\n--- SMOKE TEST RESULTS ---');
    for (const [step, status] of Object.entries(testStatus)) {
      console.log(`${step}: ${status}`);
    }
  } catch (err) {
    console.error(`\n❌ Smoke Test Failed: ${err.message}`);
    console.log('\n--- PARTIAL SMOKE TEST RESULTS ---');
    for (const [step, status] of Object.entries(testStatus)) {
      console.log(`${step}: ${status}`);
    }
    process.exit(1);
  }
}

runSmokeTest();
