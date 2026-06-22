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
  console.log("🚀 Iniciando auditoria e limpeza do ambiente de seed...");

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
    console.log(`🧹 Encontrados ${allSimulatedUsers.length} usuários simulados anteriores. Removendo...`);
    for (const u of allSimulatedUsers) {
      const { error: delError } = await supabase.auth.admin.deleteUser(u.id);
      if (delError) {
        console.warn(`⚠️ Erro ao deletar usuário ${u.email}:`, delError.message);
      }
    }
    console.log("✅ Limpeza de usuários anteriores finalizada.");
  } else {
    console.log("✨ Nenhum usuário simulado antigo encontrado.");
  }

  // 2. Verificar a existência da tabela 'billing_events'
  let hasBillingTable = false;
  const { error: checkErr } = await supabase.from("billing_events").select("id").limit(1);
  if (checkErr && checkErr.message.includes("Could not find the table")) {
    console.warn("\n⚠️ AVISO IMPORTANTE: A tabela 'billing_events' está ausente no Supabase.");
    console.warn("   Para criá-la permanentemente, execute o SQL em 'supabase_migration_v5_billing.sql' no SQL Editor do seu console Supabase.");
    console.warn("   O script prosseguirá salvando todos os logs analíticos na tabela 'events'.\n");
  } else {
    hasBillingTable = true;
    console.log("📊 Tabela 'billing_events' detectada e pronta para gravação.");
  }

  // 3. Preparar array de usuários para criação (Exatamente 100)
  // 60 Free, 30 Premium Ativo, 5 Cancelados, 5 Reativados
  const userQueue = [];
  
  // 60 Free
  for (let i = 1; i <= 60; i++) {
    userQueue.push({ type: "free", index: i });
  }
  // 30 Premium
  for (let i = 1; i <= 30; i++) {
    userQueue.push({ type: "premium", index: i });
  }
  // 5 Canceled
  for (let i = 1; i <= 5; i++) {
    userQueue.push({ type: "canceled", index: i });
  }
  // 5 Reactivated
  for (let i = 1; i <= 5; i++) {
    userQueue.push({ type: "reactivated", index: i });
  }

  console.log(`👥 Iniciando criação de 100 usuários simulados...`);
  let createdProfilesCount = 0;
  let createdEventsCount = 0;

  const handleUserCreation = async (userSpec) => {
    const { type, index } = userSpec;
    const email = `simulated_${type}_${index}_${randomUUID().slice(0, 8)}@fakeflowday.com`;
    const password = "SimulatedPassword123!";

    // Criar na tabela auth.users
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: `Simulado ${type.toUpperCase()} ${index}`,
        nickname: `sim_${type}_${index}`
      }
    });

    if (authError) {
      console.error(`❌ Erro ao criar auth user (${type} ${index}):`, authError.message);
      return null;
    }

    const userId = authData.user.id;
    
    // Atualizar perfil correspondente
    let plan = "free";
    let status = "free";
    let subStart = null;
    let subEnd = null;
    let customerId = null;

    if (type === "premium") {
      plan = "premium";
      status = "ACTIVE";
      subStart = dateOffsetDays(-15);
      subEnd = dateOffsetDays(15);
      customerId = `mp_${randomUUID()}`;
    } else if (type === "canceled") {
      plan = "free";
      status = "CANCELED";
      subStart = dateOffsetDays(-45);
      subEnd = dateOffsetDays(-15);
      customerId = `mp_${randomUUID()}`;
    } else if (type === "reactivated") {
      plan = "premium";
      status = "ACTIVE";
      subStart = dateOffsetDays(-5);
      subEnd = dateOffsetDays(25);
      customerId = `mp_${randomUUID()}`;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        plano: plan,
        assinatura_status: status,
        assinatura_inicio: subStart,
        assinatura_expira_em: subEnd,
        mercadopago_customer_id: customerId,
        updated_at: new Date().toISOString()
      })
      .eq("id", userId);

    if (profileError) {
      console.error(`❌ Erro ao atualizar profile para ${email}:`, profileError.message);
      return null;
    }

    createdProfilesCount++;

    // Gerar eventos realistas
    const userEvents = [];
    const billingEvents = [];

    if (type === "free") {
      userEvents.push({
        user_id: userId,
        event_type: "user_created_free",
        metadata: {},
        created_at: dateOffsetDays(-20)
      });
    } else if (type === "premium") {
      const payId = `pay_${randomUUID()}`;
      userEvents.push(
        {
          user_id: userId,
          event_type: "payment_received",
          metadata: { payment_id: payId, status: "approved" },
          created_at: dateOffsetDays(-15)
        },
        {
          user_id: userId,
          event_type: "payment_approved",
          metadata: { payment_id: payId, amount: 14.90, date_approved: dateOffsetDays(-15) },
          created_at: dateOffsetDays(-15)
        },
        {
          user_id: userId,
          event_type: "user_upgraded",
          metadata: { plano: "premium", status: "ACTIVE", customer_id: customerId, expires_at: dateOffsetDays(15) },
          created_at: dateOffsetDays(-15)
        }
      );

      billingEvents.push({
        id: randomUUID(),
        payment_id: payId,
        user_id: userId,
        status: "approved",
        created_at: dateOffsetDays(-15)
      });
    } else if (type === "canceled") {
      const payId = `pay_${randomUUID()}`;
      const refundId = `down_${randomUUID()}`;
      userEvents.push(
        {
          user_id: userId,
          event_type: "payment_received",
          metadata: { payment_id: payId, status: "approved" },
          created_at: dateOffsetDays(-45)
        },
        {
          user_id: userId,
          event_type: "payment_approved",
          metadata: { payment_id: payId, amount: 14.90, date_approved: dateOffsetDays(-45) },
          created_at: dateOffsetDays(-45)
        },
        {
          user_id: userId,
          event_type: "user_upgraded",
          metadata: { plano: "premium", status: "ACTIVE", customer_id: customerId, expires_at: dateOffsetDays(-15) },
          created_at: dateOffsetDays(-45)
        },
        {
          user_id: userId,
          event_type: "payment_failed",
          metadata: { reason: "payment_canceled" },
          created_at: dateOffsetDays(-15)
        },
        {
          user_id: userId,
          event_type: "user_downgraded",
          metadata: { plano: "free", status: "EXPIRED" },
          created_at: dateOffsetDays(-15)
        }
      );

      billingEvents.push(
        {
          id: randomUUID(),
          payment_id: payId,
          user_id: userId,
          status: "approved",
          created_at: dateOffsetDays(-45)
        },
        {
          id: randomUUID(),
          payment_id: refundId,
          user_id: userId,
          status: "refunded",
          created_at: dateOffsetDays(-15)
        }
      );
    } else if (type === "reactivated") {
      const payId1 = `pay_${randomUUID()}`;
      const refundId = `down_${randomUUID()}`;
      const payId2 = `pay_${randomUUID()}`;

      userEvents.push(
        // Primeiro ciclo
        {
          user_id: userId,
          event_type: "payment_received",
          metadata: { payment_id: payId1, status: "approved" },
          created_at: dateOffsetDays(-65)
        },
        {
          user_id: userId,
          event_type: "payment_approved",
          metadata: { payment_id: payId1, amount: 14.90, date_approved: dateOffsetDays(-65) },
          created_at: dateOffsetDays(-65)
        },
        {
          user_id: userId,
          event_type: "user_upgraded",
          metadata: { plano: "premium", status: "ACTIVE", customer_id: customerId, expires_at: dateOffsetDays(-35) },
          created_at: dateOffsetDays(-65)
        },
        // Cancelamento
        {
          user_id: userId,
          event_type: "payment_failed",
          metadata: { reason: "past_due" },
          created_at: dateOffsetDays(-35)
        },
        {
          user_id: userId,
          event_type: "user_downgraded",
          metadata: { plano: "free", status: "EXPIRED" },
          created_at: dateOffsetDays(-35)
        },
        // Reativação recente (com desconto)
        {
          user_id: userId,
          event_type: "payment_received",
          metadata: { payment_id: payId2, status: "approved" },
          created_at: dateOffsetDays(-5)
        },
        {
          user_id: userId,
          event_type: "payment_approved",
          metadata: { payment_id: payId2, amount: 11.90, date_approved: dateOffsetDays(-5) },
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
          event_type: "subscription_recovered",
          metadata: { payment_id: payId2, recovered_at: dateOffsetDays(-5) },
          created_at: dateOffsetDays(-5)
        },
        {
          user_id: userId,
          event_type: "user_upgraded",
          metadata: { plano: "premium", status: "ACTIVE", customer_id: customerId, expires_at: dateOffsetDays(25) },
          created_at: dateOffsetDays(-5)
        }
      );

      billingEvents.push(
        {
          id: randomUUID(),
          payment_id: payId1,
          user_id: userId,
          status: "approved",
          created_at: dateOffsetDays(-65)
        },
        {
          id: randomUUID(),
          payment_id: refundId,
          user_id: userId,
          status: "refunded",
          created_at: dateOffsetDays(-35)
        },
        {
          id: randomUUID(),
          payment_id: payId2,
          user_id: userId,
          status: "approved",
          created_at: dateOffsetDays(-5)
        }
      );
    }

    // Gravar no banco de dados
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

  // Executar a criação em lotes de 10 usuários simultâneos para evitar sobrecarga
  await processInBatches(userQueue, 10, handleUserCreation);

  console.log("\n=========================================");
  console.log("🎉 SIMULAÇÃO CONCLUÍDA COM SUCESSO!");
  console.log("=========================================");

  // 4. Calcular Métricas
  // 30 Premium Ativos (R$ 14,90/mês)
  // 5 Reativados Ativos (R$ 11,90/mês com desconto de retenção)
  // Total de assinantes Pro ativos = 35
  // Churn = 5 cancelados (downgrade nos últimos 30 dias)
  const premiumCount = 30;
  const reactivatedCount = 5;
  const activeSubscribers = premiumCount + reactivatedCount;
  const churnedCount = 5;

  const mrr = (premiumCount * 14.90) + (reactivatedCount * 11.90);
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
  console.error("💥 Falha crítica na execução do seed:", err);
});