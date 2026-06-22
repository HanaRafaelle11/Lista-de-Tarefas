import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Erro: SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY ausentes no .env.local!");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function normalize() {
  console.log("🔍 Buscando perfis existentes no Supabase...");
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, name, plano, assinatura_status");

  if (error) {
    console.error("❌ Erro ao buscar perfis:", error.message);
    process.exit(1);
  }

  console.log(`📊 Encontrados ${profiles.length} perfis. Analisando padronização...`);

  let updatedCount = 0;

  for (const profile of profiles) {
    const originalPlan = profile.plano;
    const originalStatus = profile.assinatura_status;

    // Normalizar Plano
    let plan = (originalPlan || "free").toLowerCase().trim();
    if (plan === "gratuito") {
      plan = "free";
    }
    if (plan !== "free" && plan !== "premium") {
      plan = "free";
    }

    // Normalizar Status de Assinatura
    let status = (originalStatus || "canceled").toLowerCase().trim();
    if (status === "active") status = "active";
    else if (status === "canceled" || status === "expired" || status === "free" || status === "none") {
      status = "canceled";
    } else if (status === "trialing") status = "trialing";
    else if (status === "past_due") status = "past_due";
    else {
      // Mapeamento de fallback
      status = "canceled";
    }

    // Verificar se houve mudança
    if (plan !== originalPlan || status !== originalStatus) {
      console.log(`   ⚙️ Normalizando user ${profile.name || profile.id}:`);
      console.log(`      Plano: '${originalPlan}' ➔ '${plan}'`);
      console.log(`      Status: '${originalStatus}' ➔ '${status}'`);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          plano: plan,
          assinatura_status: status,
          updated_at: new Date().toISOString()
        })
        .eq("id", profile.id);

      if (updateError) {
        console.error(`      ❌ Erro ao atualizar perfil ${profile.id}:`, updateError.message);
      } else {
        updatedCount++;
      }
    }
  }

  console.log(`\n✅ Normalização concluída! Perfis atualizados: ${updatedCount}/${profiles.length}`);
}

normalize().catch(err => {
  console.error("💥 Erro crítico durante normalização:", err);
});
