import { supabaseAdmin } from '../../services/supabase/index.js';
import { logger } from '../../services/logger/index.js';

export async function processGrowthOSEngine({ traceId }) {
  logger.info('growth.engine.process.start', { traceId });

  if (!supabaseAdmin) {
    return {
      riskEvaluated: 5,
      leaksDetected: 2,
      actionsTriggered: 3,
      closedLoopEvaluated: 1,
      note: 'Mock environment'
    };
  }

  try {
    const now = new Date();
    const nowIso = now.toISOString();

    // 1. RISK ENGINE & REVENUE LEAK ENGINE
    const { data: users } = await supabaseAdmin.from('profiles').select('id, email, role, last_access, created_at').limit(100);

    let riskCount = 0;
    let leakCount = 0;
    let actionCount = 0;

    if (users && users.length > 0) {
      for (const user of users) {
        const lastAccess = user.last_access ? new Date(user.last_access) : new Date(user.created_at || now);
        const daysInactive = Math.floor((now.getTime() - lastAccess.getTime()) / (1000 * 60 * 60 * 24));

        let riskLevel = 'low';
        let reason = 'Usuário ativo recentemente';

        if (daysInactive >= 7) {
          riskLevel = 'high';
          reason = `Usuário inativo há ${daysInactive} dias sem acesso`;
        } else if (daysInactive >= 3) {
          riskLevel = 'medium';
          reason = `Queda de engajamento: inativo há ${daysInactive} dias`;
        }

        // Persistir Perfil de Risco
        await supabaseAdmin.from('user_risk_profile').upsert({
          user_id: user.id,
          risk_level: riskLevel,
          reason_summary: reason,
          last_calculated_at: nowIso
        });
        riskCount++;

        // Detectar Revenue Leak (Se usuário for PRO ou tiver inatividade relevante)
        if (user.role === 'pro' && daysInactive >= 3) {
          await supabaseAdmin.from('revenue_leaks').insert({
            user_id: user.id,
            leak_type: 'pro_user_inactive',
            estimated_value_loss: 29.90,
            severity: daysInactive >= 7 ? 'critical' : 'high',
            detected_at: nowIso
          });
          leakCount++;
        }

        // 3. ACTION ENGINE
        if (riskLevel === 'high' || daysInactive >= 3) {
          const actionType = user.role === 'pro' ? 'value_reactivation_message' : 'onboarding_reminder';
          
          const { data: action } = await supabaseAdmin.from('growth_actions').insert({
            user_id: user.id,
            action_type: actionType,
            triggered_by_event: 'risk_engine_threshold',
            status: 'executed'
          }).select('id').single();

          if (action) {
            // Enviar notificação push automática no pipeline existente
            await supabaseAdmin.from('notification_queue').insert({
              user_id: user.id,
              title: user.role === 'pro' ? 'Sentimos sua falta no MyFlowDay ⚡' : 'Retome seus objetivos hoje! 🎯',
              body: 'Seus hábitos e tarefas estão esperando por você.',
              scheduled_for: nowIso,
              status: 'pending'
            });
            actionCount++;
          }
        }
      }
    }

    // 4. CLOSED LOOP EVALUATION
    const { data: pendingActions } = await supabaseAdmin.from('growth_actions').select('*').eq('status', 'executed').limit(20);
    let closedLoopCount = 0;

    if (pendingActions && pendingActions.length > 0) {
      for (const act of pendingActions) {
        // Verificar se usuário acessou o app após a ação ser criada
        const { data: userProfile } = await supabaseAdmin.from('profiles').select('last_access').eq('id', act.user_id).maybeSingle();
        const returned = userProfile?.last_access && new Date(userProfile.last_access) > new Date(act.created_at);

        await supabaseAdmin.from('growth_action_results').insert({
          action_id: act.id,
          user_id: act.user_id,
          user_returned: !!returned,
          payment_recovered: false,
          engagement_increased: !!returned,
          evaluated_at: nowIso
        });
        closedLoopCount++;
      }
    }

    logger.info('growth.engine.process.finish', { traceId, riskCount, leakCount, actionCount, closedLoopCount });

    return {
      riskEvaluated: riskCount,
      leaksDetected: leakCount,
      actionsTriggered: actionCount,
      closedLoopEvaluated: closedLoopCount
    };

  } catch (err) {
    logger.error('growth.engine.process.error', { traceId, error: err.message });
    return { error: err.message };
  }
}
