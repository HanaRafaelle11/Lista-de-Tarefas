import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

// ==========================================
// SUPABASE CLIENT INITIALIZATION
// ==========================================
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Erro: SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY ausentes no .env.local!");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  }
);

// ==========================================
// UTILS
// ==========================================
function dateOffsetDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function processInBatches(items, batchSize, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    console.log(`   ⏳ Processando lote de usuários ${i + 1} a ${Math.min(i + batchSize, items.length)}...`);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

// ==========================================
// MAIN SEED FUNCTION
// ==========================================
async function seed() {
  console.log("🚀 Iniciando Stripe Seed V2 (Ambiente Real)...");

  // 1. Limpar usuários simulados anteriores (*@fakeflowday.com)
  let page = 1;
  let allSimulatedUsers = [];
  while (true) {
    const { data: { users }, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100
    });
    if (error) {
      console.error("❌ Erro ao listar usuários para limpeza:", error.message);
      break;
    }
    if (!users || users.length === 0) break;
    const simulated = users.filter(u => u.email?.endsWith("@fakeflowday.com"));
    allSimulatedUsers.push(...simulated);
    if (users.length < 100) break;
    page++;
  }

  if (allSimulatedUsers.length > 0) {
    console.log(`🧹 Encontrados ${allSimulatedUsers.length} usuários simulados antigos. Removendo...`);
    for (const u of allSimulatedUsers) {
      const { error: delError } = await supabase.auth.admin.deleteUser(u.id);
      if (delError) {
        console.warn(`⚠️ Erro ao deletar usuário ${u.email}:`, delError.message);
      }
    }
    console.log("✅ Limpeza concluída.");
  } else {
    console.log("✨ Nenhum usuário simulado antigo encontrado.");
  }

  // 2. Verificar a existência da tabela 'billing_events'
  let hasBillingTable = false;
  const { error: checkErr } = await supabase.from("billing_events").select("id").limit(1);
  if (checkErr && checkErr.message.includes("Could not find the table")) {
    console.warn("\n⚠️ AVISO: A tabela 'billing_events' está ausente no Supabase.");
    console.warn("   Para criá-la permanentemente, execute o SQL em 'supabase_migration_v5_billing.sql' no SQL Editor.");
    console.warn("   O script registrará os eventos em 'events' (usado nas análises) e tentará gravar em 'billing_events' se existir.\n");
  } else {
    hasBillingTable = true;
    console.log("📊 Tabela 'billing_events' detectada e pronta para gravação.");
  }

  // 3. Preparar array de usuários para criação (Exatamente 80)
  // - 25 new_free
  // - 25 trial_to_paid
  // - 15 active
  // - 10 churned
  // - 5 reactivated
  const userQueue = [];
  
  for (let i = 1; i <= 25; i++) userQueue.push({ lifecycle: "new_free", index: i });
  for (let i = 1; i <= 25; i++) userQueue.push({ lifecycle: "trial_to_paid", index: i });
  for (let i = 1; i <= 15; i++) userQueue.push({ lifecycle: "active", index: i });
  for (let i = 1; i <= 10; i++) userQueue.push({ lifecycle: "churned", index: i });
  for (let i = 1; i <= 5; i++) userQueue.push({ lifecycle: "reactivated", index: i });

  console.log(`👥 Iniciando criação de 80 usuários com ciclos de vida Stripe...`);
  let createdProfilesCount = 0;
  let createdEventsCount = 0;

  const handleUserCreation = async (userSpec) => {
    const { lifecycle, index } = userSpec;
    const email = `simulated_${lifecycle}_${index}_${randomUUID().slice(0, 8)}@fakeflowday.com`;
    const password = "SimulatedPassword123!";

    // Criar na tabela auth.users
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: `Simulado Stripe ${lifecycle.toUpperCase()} ${index}`,
        nickname: `sim_stripe_${lifecycle}_${index}`
      }
    });

    if (authError) {
      console.error(`❌ Erro ao criar auth user (${lifecycle} ${index}):`, authError.message);
      return null;
    }

    const userId = authData.user.id;
    
    // Configurações do perfil
    let plan = "free";
    let status = "canceled";
    let subStart = null;
    let subEnd = null;
    let customerId = null;

    if (lifecycle === "trial_to_paid") {
      plan = "premium";
      status = "active";
      subStart = dateOffsetDays(-30);
      subEnd = dateOffsetDays(30);
      customerId = `cus_${randomUUID()}`;
    } else if (lifecycle === "active") {
      plan = "premium";
      status = "active";
      subStart = dateOffsetDays(-15);
      subEnd = dateOffsetDays(15);
      customerId = `cus_${randomUUID()}`;
    } else if (lifecycle === "churned") {
      plan = "free";
      status = "canceled";
      subStart = dateOffsetDays(-45);
      subEnd = dateOffsetDays(-15);
      customerId = `cus_${randomUUID()}`;
    } else if (lifecycle === "reactivated") {
      plan = "premium";
      status = "active";
      subStart = dateOffsetDays(-5);
      subEnd = dateOffsetDays(25);
      customerId = `cus_${randomUUID()}`;
    }

    // Atualizar perfil no Supabase
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        plano: plan,
        assinatura_status: status,
        assinatura_inicio: subStart,
        assinatura_expira_em: subEnd,
        asaas_customer_id: customerId,
        updated_at: new Date().toISOString()
      })
      .eq("id", userId);

    if (profileError) {
      console.error(`❌ Erro ao atualizar profile para ${email}:`, profileError.message);
      return null;
    }

    createdProfilesCount++;

    // Criar/atualizar assinatura correspondente na tabela 'subscriptions'
    const subscriptionData = {
      user_id: userId,
      status: status === "free" ? "active" : status, // standard billing status mapping
      plan: plan,
      price: plan === "premium" ? (lifecycle === "reactivated" ? 11.90 : 14.90) : 0.0,
      created_at: subStart || new Date().toISOString(),
      updated_at: lifecycle === "churned" ? subEnd : (subStart || new Date().toISOString())
    };

    const { error: subError } = await supabase
      .from("subscriptions")
      .upsert(subscriptionData, { onConflict: "user_id" });

    if (subError) {
      console.error(`❌ Erro ao criar subscription para ${email}:`, subError.message);
    }

    // Gerar eventos realistas
    const userEvents = [];
    const billingEvents = [];

    if (lifecycle === "new_free") {
      userEvents.push({
        user_id: userId,
        event_type: "user_created_free",
        metadata: { source: "signup" },
        created_at: dateOffsetDays(-20)
      });
      billingEvents.push({
        id: randomUUID(),
        payment_id: `free_${randomUUID()}`,
        user_id: userId,
        status: "user_created_free",
        created_at: dateOffsetDays(-20)
      });
    } else if (lifecycle === "trial_to_paid") {
      const payId = `pay_${randomUUID()}`;
      userEvents.push(
        {
          user_id: userId,
          event_type: "trial_started",
          metadata: { plan: "premium" },
          created_at: dateOffsetDays(-40)
        },
        {
          user_id: userId,
          event_type: "payment_success",
          metadata: { payment_id: payId, amount: 14.90 },
          created_at: dateOffsetDays(-30)
        },
        {
          user_id: userId,
          event_type: "user_upgraded",
          metadata: { plano: "premium", status: "active", expires_at: dateOffsetDays(30) },
          created_at: dateOffsetDays(-30)
        }
      );
      billingEvents.push(
        {
          id: randomUUID(),
          payment_id: `trial_${randomUUID()}`,
          user_id: userId,
          status: "trial_started",
          created_at: dateOffsetDays(-40)
        },
        {
          id: randomUUID(),
          payment_id: payId,
          user_id: userId,
          status: "payment_success",
          created_at: dateOffsetDays(-30)
        },
        {
          id: randomUUID(),
          payment_id: `upg_${randomUUID()}`,
          user_id: userId,
          status: "user_upgraded",
          created_at: dateOffsetDays(-30)
        }
      );
    } else if (lifecycle === "active") {
      const payId = `pay_${randomUUID()}`;
      userEvents.push(
        {
          user_id: userId,
          event_type: "payment_success",
          metadata: { payment_id: payId, amount: 14.90 },
          created_at: dateOffsetDays(-15)
        },
        {
          user_id: userId,
          event_type: "user_upgraded",
          metadata: { plano: "premium", status: "active", expires_at: dateOffsetDays(15) },
          created_at: dateOffsetDays(-15)
        }
      );
      billingEvents.push(
        {
          id: randomUUID(),
          payment_id: payId,
          user_id: userId,
          status: "payment_success",
          created_at: dateOffsetDays(-15)
        },
        {
          id: randomUUID(),
          payment_id: `upg_${randomUUID()}`,
          user_id: userId,
          status: "user_upgraded",
          created_at: dateOffsetDays(-15)
        }
      );
    } else if (lifecycle === "churned") {
      const payId = `pay_${randomUUID()}`;
      userEvents.push(
        {
          user_id: userId,
          event_type: "payment_success",
          metadata: { payment_id: payId, amount: 14.90 },
          created_at: dateOffsetDays(-45)
        },
        {
          user_id: userId,
          event_type: "user_upgraded",
          metadata: { plano: "premium", status: "active", expires_at: dateOffsetDays(-15) },
          created_at: dateOffsetDays(-45)
        },
        {
          user_id: userId,
          event_type: "subscription_canceled",
          metadata: { reason: "user_request" },
          created_at: dateOffsetDays(-15)
        }
      );
      billingEvents.push(
        {
          id: randomUUID(),
          payment_id: payId,
          user_id: userId,
          status: "payment_success",
          created_at: dateOffsetDays(-45)
        },
        {
          id: randomUUID(),
          payment_id: `upg_${randomUUID()}`,
          user_id: userId,
          status: "user_upgraded",
          created_at: dateOffsetDays(-45)
        },
        {
          id: randomUUID(),
          payment_id: `cnc_${randomUUID()}`,
          user_id: userId,
          status: "subscription_canceled",
          created_at: dateOffsetDays(-15)
        }
      );
    } else if (lifecycle === "reactivated") {
      const payId1 = `pay_${randomUUID()}`;
      const payId2 = `pay_${randomUUID()}`;
      userEvents.push(
        // Primeiro ciclo
        {
          user_id: userId,
          event_type: "payment_success",
          metadata: { payment_id: payId1, amount: 14.90 },
          created_at: dateOffsetDays(-65)
        },
        {
          user_id: userId,
          event_type: "user_upgraded",
          metadata: { plano: "premium", status: "active", expires_at: dateOffsetDays(-35) },
          created_at: dateOffsetDays(-65)
        },
        // Churn
        {
          user_id: userId,
          event_type: "subscription_canceled",
          metadata: { reason: "past_due" },
          created_at: dateOffsetDays(-35)
        },
        // Reativação
        {
          user_id: userId,
          event_type: "payment_success",
          metadata: { payment_id: payId2, amount: 11.90 },
          created_at: dateOffsetDays(-5)
        },
        {
          user_id: userId,
          event_type: "user_reactivated",
          metadata: { payment_id: payId2, recovered_at: dateOffsetDays(-5) },
          created_at: dateOffsetDays(-5)
        },
        {
          user_id: userId,
          event_type: "user_upgraded",
          metadata: { plano: "premium", status: "active", expires_at: dateOffsetDays(25) },
          created_at: dateOffsetDays(-5)
        }
      );
      billingEvents.push(
        {
          id: randomUUID(),
          payment_id: payId1,
          user_id: userId,
          status: "payment_success",
          created_at: dateOffsetDays(-65)
        },
        {
          id: randomUUID(),
          payment_id: `upg_${randomUUID()}`,
          user_id: userId,
          status: "user_upgraded",
          created_at: dateOffsetDays(-65)
        },
        {
          id: randomUUID(),
          payment_id: `cnc_${randomUUID()}`,
          user_id: userId,
          status: "subscription_canceled",
          created_at: dateOffsetDays(-35)
        },
        {
          id: randomUUID(),
          payment_id: payId2,
          user_id: userId,
          status: "payment_success",
          created_at: dateOffsetDays(-5)
        },
        {
          id: randomUUID(),
          payment_id: `rec_${randomUUID()}`,
          user_id: userId,
          status: "user_reactivated",
          created_at: dateOffsetDays(-5)
        },
        {
          id: randomUUID(),
          payment_id: `upg2_${randomUUID()}`,
          user_id: userId,
          status: "user_upgraded",
          created_at: dateOffsetDays(-5)
        }
      );
    }

    // Gravar eventos no Supabase
    const { error: eventsErr } = await supabase.from("events").insert(userEvents);
    if (eventsErr) {
      console.error(`❌ Erro ao registrar eventos para ${email}:`, eventsErr.message);
    } else {
      createdEventsCount += userEvents.length;
    }

    if (hasBillingTable && billingEvents.length > 0) {
      const { error: billingErr } = await supabase.from("billing_events").insert(billingEvents);
      if (billingErr) {
        console.warn(`⚠️ Erro ao registrar billing_events para ${email}:`, billingErr.message);
      } else {
        createdEventsCount += billingEvents.length;
      }
    }

    return userId;
  };

  // Executar criação em lotes de 10
  await processInBatches(userQueue, 10, handleUserCreation);

  console.log("\n=========================================");
  console.log("🎉 STRIPE SEED V2 CONCLUÍDO COM SUCESSO!");
  console.log("=========================================");

  // 4. Consolidação das Métricas Fiscais V2
  // - 25 new_free (free/canceled) => R$ 0.00
  // - 25 trial_to_paid (premium/active) => 25 * 14.90 = R$ 372.50
  // - 15 active (premium/active) => 15 * 14.90 = R$ 223.50
  // - 10 churned (free/canceled) => R$ 0.00
  // - 5 reactivated (premium/active) => 5 * 11.90 = R$ 59.50
  // Total Ativos = 25 + 15 + 5 = 45 usuários
  // Total Churnados = 10 usuários (churned)
  const trialToPaidCount = 25;
  const activeCount = 15;
  const reactivatedCount = 5;
  const activeSubscribers = trialToPaidCount + activeCount + reactivatedCount;
  const churnedCount = 10;

  const mrr = (trialToPaidCount * 14.90) + (activeCount * 14.90) + (reactivatedCount * 11.90);
  const arr = mrr * 12;
  const churnRate = (activeSubscribers + churnedCount) > 0 
    ? (churnedCount / (activeSubscribers + churnedCount)) * 100 
    : 0;

  console.log(`👥 Profiles criados/atualizados: ${createdProfilesCount}`);
  console.log(`📈 Eventos analíticos persistidos: ${createdEventsCount}`);
  console.log(`💵 MRR (Receita Recorrente Mensal) estimado: R$ ${mrr.toFixed(2)}`);
  console.log(`💰 ARR (Receita Recorrente Anual) estimado: R$ ${arr.toFixed(2)}`);
  console.log(`📉 Churn Rate estimado: ${churnRate.toFixed(1)}%`);
  console.log("=========================================\n");
}

seed().catch((err) => {
  console.error("💥 Falha crítica na execução do seed V2:", err);
});
