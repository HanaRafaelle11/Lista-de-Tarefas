import { supabaseAdmin } from '../../services/supabase/index.js';
import { logger } from '../../services/logger/index.js';

function isTableMissingError(err) {
  if (!err) return false;
  const errMsg = err.message || JSON.stringify(err);
  return err.code === 'PGRST204' || 
         err.code === '42P01' ||
         errMsg.includes('relation') || 
         errMsg.includes('Could not find the table') ||
         errMsg.includes('does not exist');
}

export async function processGrowthOSEngine({ traceId }) {
  logger.info('growth.engine.process.start', { traceId });

  if (!supabaseAdmin) {
    return {
      riskEvaluated: 0,
      leaksDetected: 0,
      actionsTriggered: 0,
      closedLoopEvaluated: 0,
      note: 'Mock environment',
      growthOSActive: false
    };
  }

  const results = {
    riskEvaluated: 0,
    leaksDetected: 0,
    actionsTriggered: 0,
    closedLoopEvaluated: 0,
    growthOSActive: true
  };

  try {
    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Verificar se a tabela de perfis existe e carregar dados
    const { data: users, error: usersErr } = await supabaseAdmin
      .from('profiles')
      .select('id, name, plano, assinatura_status, updated_at, created_at')
      .limit(100);

    if (usersErr) {
      if (isTableMissingError(usersErr)) {
        logger.warn('growth.engine.profiles_missing', { traceId, reason: 'Tabela profiles ausente.' });
        return { ...results, growthOSActive: false, note: 'Profiles table missing' };
      }
      logger.error('growth.engine.profiles_fetch_failed', { traceId, error: usersErr.message });
      throw new Error(`SCHEMA_MISMATCH: profiles table error. (${usersErr.message})`);
    }

    if (!users || users.length === 0) {
      logger.info('growth.engine.no_users', { traceId });
      return results;
    }

    for (const user of users) {
      const lastAccess = user.updated_at ? new Date(user.updated_at) : new Date(user.created_at || now);
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

      // Persistir Perfil de Risco (Exige tabela user_risk_profile)
      const { error: riskErr } = await supabaseAdmin.from('user_risk_profile').upsert({
        user_id: user.id,
        risk_level: riskLevel,
        reason_summary: reason,
        last_calculated_at: nowIso
      });

      if (riskErr) {
        if (isTableMissingError(riskErr)) {
          logger.warn('growth.engine.inactive', { traceId, reason: 'Tabela user_risk_profile ausente.' });
          return {
            ...results,
            growthOSActive: false,
            note: 'Growth OS inativo (tabelas ausentes)'
          };
        }
        logger.error('growth.engine.user_risk_profile_failed', { traceId, userId: user.id, error: riskErr.message });
        throw new Error(`SCHEMA_MISMATCH: user_risk_profile table missing or inconsistent. (${riskErr.message})`);
      }
      results.riskEvaluated++;

      // Detectar vazamentos de receita (revenue leaks)
      if (user.assinatura_status === 'active' && daysInactive >= 3) {
        const { error: leakErr } = await supabaseAdmin.from('revenue_leaks').insert({
          user_id: user.id,
          leak_type: 'pro_user_inactive',
          estimated_value_loss: 29.90,
          severity: daysInactive >= 7 ? 'critical' : 'high',
          detected_at: nowIso
        });

        if (leakErr) {
          if (isTableMissingError(leakErr)) {
            logger.warn('growth.engine.inactive', { traceId, reason: 'Tabela revenue_leaks ausente.' });
            return {
              ...results,
              growthOSActive: false,
              note: 'Growth OS inativo (tabelas ausentes)'
            };
          }
          logger.error('growth.engine.revenue_leaks_failed', { traceId, userId: user.id, error: leakErr.message });
          throw new Error(`SCHEMA_MISMATCH: revenue_leaks table missing or inconsistent. (${leakErr.message})`);
        }
        results.leaksDetected++;
      }

      // Action Engine - Ações de engajamento
      if (riskLevel === 'high' || daysInactive >= 3) {
        const actionType = user.assinatura_status === 'active' ? 'value_reactivation_message' : 'onboarding_reminder';
        
        const { data: action, error: actionErr } = await supabaseAdmin.from('growth_actions').insert({
          user_id: user.id,
          action_type: actionType,
          triggered_by_event: 'risk_engine_threshold',
          status: 'executed'
        }).select('id').single();

        if (actionErr) {
          if (isTableMissingError(actionErr)) {
            logger.warn('growth.engine.inactive', { traceId, reason: 'Tabela growth_actions ausente.' });
            return {
              ...results,
              growthOSActive: false,
              note: 'Growth OS inativo (tabelas ausentes)'
            };
          }
          logger.error('growth.engine.growth_actions_failed', { traceId, userId: user.id, error: actionErr.message });
          throw new Error(`SCHEMA_MISMATCH: growth_actions table missing or inconsistent. (${actionErr.message})`);
        }

        if (action) {
          // Growth notifications don't have a task_id, but the production notification_queue
          // requires task_id NOT NULL (v17 entity-based schema not yet applied).
          // Degrade gracefully: log the action and skip notification enqueue until schema is updated.
          logger.info('growth.engine.action_executed', {
            traceId,
            userId: user.id,
            actionType,
            actionId: action.id,
            note: 'Notification enqueue skipped — notification_queue requires task_id (v17 migration pending)'
          });
          results.actionsTriggered++;
        }
      }
    }

    // Closed Loop Evaluation
    const { data: pendingActions, error: pendingActionsErr } = await supabaseAdmin
      .from('growth_actions')
      .select('*')
      .eq('status', 'executed')
      .limit(20);

    if (pendingActionsErr) {
      if (isTableMissingError(pendingActionsErr)) {
        logger.warn('growth.engine.inactive', { traceId, reason: 'Tabela growth_actions ausente no closed loop.' });
        return {
          ...results,
          growthOSActive: false,
          note: 'Growth OS inativo (tabelas ausentes)'
        };
      }
      logger.error('growth.engine.pending_actions_failed', { traceId, error: pendingActionsErr.message });
      throw new Error(`SCHEMA_MISMATCH: growth_actions read error. (${pendingActionsErr.message})`);
    }

    if (pendingActions && pendingActions.length > 0) {
      for (const act of pendingActions) {
        const { data: userProfile, error: profileFetchErr } = await supabaseAdmin
          .from('profiles')
          .select('updated_at')
          .eq('id', act.user_id)
          .maybeSingle();

        if (profileFetchErr) throw profileFetchErr;

        const returned = userProfile?.updated_at && new Date(userProfile.updated_at) > new Date(act.created_at);

        const { error: resultErr } = await supabaseAdmin.from('growth_action_results').insert({
          action_id: act.id,
          user_id: act.user_id,
          user_returned: !!returned,
          payment_recovered: false,
          engagement_increased: !!returned,
          evaluated_at: nowIso
        });

        if (resultErr) {
          if (isTableMissingError(resultErr)) {
            logger.warn('growth.engine.inactive', { traceId, reason: 'Tabela growth_action_results ausente.' });
            return {
              ...results,
              growthOSActive: false,
              note: 'Growth OS inativo (tabelas ausentes)'
            };
          }
          logger.error('growth.engine.growth_action_results_failed', { traceId, actionId: act.id, error: resultErr.message });
          throw new Error(`SCHEMA_MISMATCH: growth_action_results table missing or inconsistent. (${resultErr.message})`);
        }

        // Marcar ação como completada
        await supabaseAdmin
          .from('growth_actions')
          .update({ status: 'completed' })
          .eq('id', act.id);

        results.closedLoopEvaluated++;
      }
    }

    logger.info('growth.engine.process.finish', { traceId, ...results });
    return results;

  } catch (err) {
    logger.error('growth.engine.process.error', { traceId, error: err.message });
    return { ...results, error: err.message, critical: true };
  }
}
