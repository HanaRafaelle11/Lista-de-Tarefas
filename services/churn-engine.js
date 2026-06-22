import { supabaseAdmin } from '../lib/supabase.js';

/**
 * Churn Engine (Growth & Retention Intelligence)
 * 
 * Responsável por avaliar métricas de engajamento do usuário,
 * calcular o Churn Score e gerar eventos correspondentes.
 */

export const ChurnEngine = {
  /**
   * Calcula o score de Churn para um usuário específico (últimos 7 dias).
   * Score varia de 0 (saudável) a 100 (risco máximo).
   */
  async calculateChurnScore(userId) {
    if (!userId) throw new Error('[ChurnEngine] userId é obrigatório');

    console.log(`[ChurnEngine] Calculando Churn Score para o usuário ${userId}...`);

    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    // 1. Consultar eventos analíticos do usuário nos últimos 7 dias
    const { data: events, error } = await supabaseAdmin
      .from('events')
      .select('event_type, created_at')
      .eq('user_id', userId)
      .gte('created_at', sevenDaysAgo.toISOString());

    if (error) {
      console.error('[ChurnEngine] Erro ao buscar eventos do usuário:', error);
      throw error;
    }

    const totalEvents = events?.length || 0;
    
    // Contagem de métricas específicas
    let tasksCompleted = 0;
    let insightsUsed = 0;
    let logins = 0;
    let latestActivityDate = null;

    if (events && events.length > 0) {
      events.forEach(e => {
        const eventType = e.event_type;
        const createdAt = new Date(e.created_at);

        // Acompanhar última atividade
        if (!latestActivityDate || createdAt > latestActivityDate) {
          latestActivityDate = createdAt;
        }

        // Tarefas Concluídas
        if (['task_completed', 'task_toggle_complete', 'task_created'].includes(eventType)) {
          tasksCompleted++;
        }
        
        // Insights visualizados ou uso da IA
        if (['insight_viewed', 'analytics_viewed', 'coach_message_sent', 'paywall_viewed'].includes(eventType)) {
          insightsUsed++;
        }

        // Frequência de login
        if (['login', 'session_restore'].includes(eventType)) {
          logins++;
        }
      });
    }

    // Se não houver eventos recentes, buscar o updated_at do profile como fallback de última atividade
    if (!latestActivityDate) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('updated_at')
        .eq('id', userId)
        .maybeSingle();
      
      if (profile?.updated_at) {
        latestActivityDate = new Date(profile.updated_at);
      } else {
        latestActivityDate = sevenDaysAgo; // Fallback extremo
      }
    }

    // 2. Calcular Churn Score (Fórmula formal)
    let score = 50; // Ponto de partida neutro

    // Fator 1: Inatividade Temporal (Dias desde o último login/ação)
    const msSinceActive = now.getTime() - latestActivityDate.getTime();
    const daysSinceActive = msSinceActive / (1000 * 60 * 60 * 24);

    if (daysSinceActive >= 5) {
      score += 25; // Alta inatividade
    } else if (daysSinceActive >= 3) {
      score += 10;
    } else if (daysSinceActive < 1) {
      score -= 15; // Altamente ativo hoje
    }

    // Fator 2: Produtividade (Tarefas concluídas na semana)
    if (tasksCompleted === 0) {
      score += 15; // Nenhuma ação de valor no core product
    } else if (tasksCompleted >= 8) {
      score -= 20; // Super engajado
    } else if (tasksCompleted >= 3) {
      score -= 10;
    }

    // Fator 3: Autoconhecimento (Insights e Coach consultados)
    if (insightsUsed === 0) {
      score += 10; // Sem experimentar o valor SaaS
    } else if (insightsUsed >= 3) {
      score -= 15;
    }

    // Fator 4: Regularidade de Login
    if (logins === 0) {
      score += 10;
    } else if (logins >= 4) {
      score -= 10;
    }

    // Limitar score entre 0 e 100
    score = Math.max(0, Math.min(100, score));

    // Determinar classificação de risco
    let risk = 'low';
    let riskEvent = 'churn_risk_low';

    if (score > 70) {
      risk = 'high';
      riskEvent = 'churn_risk_high';
    } else if (score > 30) {
      risk = 'medium';
      riskEvent = 'churn_risk_medium';
    }

    console.log(`[ChurnEngine] [churn_score_calculated] User: ${userId}. Score: ${score}, Risco: ${risk}`);

    // 3. Persistir o evento de risco no banco de dados Supabase (Event Sourcing)
    const { error: logError } = await supabaseAdmin
      .from('events')
      .insert([{
        user_id: userId,
        event_type: riskEvent,
        metadata: {
          churn_score: score,
          risk_level: risk,
          metrics: {
            days_since_active: Math.round(daysSinceActive * 10) / 10,
            tasks_completed: tasksCompleted,
            insights_used: insightsUsed,
            logins: logins
          }
        }
      }]);

    if (logError) {
      console.warn('[ChurnEngine] Erro ao gravar evento de risco de churn no Supabase:', logError.message);
    }

    return {
      userId,
      score,
      risk,
      riskEvent,
      metrics: {
        lastActiveAt: latestActivityDate.toISOString(),
        tasksCompleted,
        insightsUsed,
        logins
      }
    };
  }
};
