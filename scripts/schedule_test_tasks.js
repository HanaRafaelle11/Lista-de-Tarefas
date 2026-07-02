import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const userId = "52412a5a-8bda-451b-b364-fde59611da27";

function getLocalDetails(offsetMinutesFromNow) {
  // Current local time has offset -03:00.
  // We offset the UTC time by -3h to get the local date/time representation via toISOString().
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000 + offsetMinutesFromNow * 60 * 1000);
  const dateStr = d.toISOString().split('T')[0];
  const timeStr = d.toISOString().split('T')[1].substring(0, 5); // HH:MM
  return { dateStr, timeStr };
}

async function run() {
  console.log("Scheduling 3 test tasks for user:", userId);

  const tests = [
    { offset: 2, title: "Tarefa Teste +2min ⏰" },
    { offset: 5, title: "Tarefa Teste +5min ⏰" },
    { offset: 10, title: "Tarefa Teste +10min ⏰" }
  ];

  for (const t of tests) {
    const { dateStr, timeStr } = getLocalDetails(t.offset);
    const desc = `Descrição da tarefa para testar fluxo automático de push.\n\n--flowday-meta--\n{"due_time":"${timeStr}","recurrence":"nenhuma"}`;

    console.log(`Creating task: "${t.title}" for Local Date: ${dateStr} Local Time: ${timeStr}`);

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: userId,
        title: t.title,
        description: desc,
        due_date: dateStr,
        completed: false,
        category: 'Trabalho',
        priority: 'Alta'
      })
      .select('id, title, due_date')
      .single();

    if (error) {
      console.error(`Error creating task "${t.title}":`, error.message);
    } else {
      console.log(`Created Task successfully! ID: ${data.id}`);
      
      // Let's query the notification_queue to see if the trigger generated the items
      // We wait 1.5 seconds for the trigger to run
      await new Promise(r => setTimeout(r, 1500));
      const { data: queueItems, error: qError } = await supabase
        .from('notification_queue')
        .select('id, title, scheduled_for, status')
        .eq('task_id', data.id);

      if (qError) {
        console.error("Error fetching queue items:", qError.message);
      } else {
        console.log(`Generated Queue Items (${queueItems.length}):`);
        queueItems.forEach(item => {
          console.log(` - ID: ${item.id}, Title: ${item.title}, Scheduled: ${item.scheduled_for}, Status: ${item.status}`);
        });
      }
    }
  }
}

run();
