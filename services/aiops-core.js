/**
 * AIOps Core Service
 * 
 * Motor centralizado para Correlação de Serviços, Root Cause Analysis (RCA),
 * Aprendizado Contínuo de Padrões e Simulação de Caos (Chaos Testing).
 */
class AIOpsCoreService {
  constructor() {
    this.chaosFlags = {
      simulatedLatencyActive: false,
      simulatedWebhookFaultActive: false,
      simulatedWorkerCrashActive: false
    };

    // Padrões de falhas conhecidos aprendidos continuamente
    this.learnedPatterns = new Map();

    // Histórico de feedbacks do admin para afinar sensibilidade (Alert fatigue tuning)
    this.feedbackLogs = [];
  }

  // Simulação de Caos
  setChaosFlag(flag, value) {
    if (flag in this.chaosFlags) {
      this.chaosFlags[flag] = !!value;
      console.log(`[AIOPS CHAOS CONFIG] Flag '${flag}' configurada para ${this.chaosFlags[flag]}`);
      return true;
    }
    return false;
  }

  getChaosFlags() {
    return { ...this.chaosFlags };
  }

  // Registrar feedback de ações corretivas executadas pelo admin
  recordFeedback(incidentKey, actionExecuted, resolvedSuccessfully = true) {
    this.feedbackLogs.push({
      incidentKey,
      actionExecuted,
      resolvedSuccessfully,
      timestamp: new Date().toISOString()
    });

    // Aprender com o feedback: incrementar ou decrementar confiança operacional
    const current = this.learnedPatterns.get(incidentKey) || { count: 0, weight: 0.5 };
    current.count += 1;
    if (resolvedSuccessfully) {
      current.weight = Math.min(current.weight + 0.1, 0.95); // Aumenta precisão
    } else {
      current.weight = Math.max(current.weight - 0.15, 0.1); // Reduz peso do padrão se não resolveu
    }
    this.learnedPatterns.set(incidentKey, current);
  }

  // Core Correlation, RCA & ML Tuning Engine
  processAndCorrelate(incidents) {
    if (!Array.isArray(incidents) || incidents.length === 0) return [];

    const now = Date.now();
    const correlationWindowMs = 60 * 1000; // Janela de correlação de 60 segundos
    const correlatedMap = new Map();

    // Passo 1: Correlacionar incidentes baseados em timestamps e entidades semelhantes
    incidents.forEach(incident => {
      // Determina chave de correlação sistêmica
      let correlationKey = null;

      // Correlaciona falhas de faturamento que ocorrem perto de drifts de faturamento
      if (incident.origin === 'billing' || incident.origin === 'ledger') {
        const userId = incident.payload?.userId || incident.payload?.user_id;
        if (userId) {
          correlationKey = `billing_ledger_${userId}`;
        }
      }

      // Se não possui chave específica de entidade, correlaciona por proximidade temporal
      if (!correlationKey) {
        correlationKey = `time_cluster_${Math.floor(new Date(incident.last_seen).getTime() / correlationWindowMs)}`;
      }

      if (!correlatedMap.has(correlationKey)) {
        correlatedMap.set(correlationKey, []);
      }
      correlatedMap.get(correlationKey).push(incident);
    });

    // Passo 2: Calcular Root Cause Analysis (RCA) para cada cluster correlacionado
    correlatedMap.forEach((cluster, key) => {
      if (cluster.length <= 1) {
        // Sem sintomas secundários correlacionados
        cluster[0].rca = {
          is_root_cause: true,
          root_cause_id: cluster[0].id,
          symptoms: [],
          explanation: "Este incidente foi isolado e não desencadeou falhas secundárias em cascata."
        };
        return;
      }

      // Ordenar cronologicamente por first_seen
      cluster.sort((a, b) => new Date(a.first_seen) - new Date(b.first_seen));

      // O mais antigo é a Causa Raiz (Root Cause)
      const rootCause = cluster[0];
      const symptoms = cluster.slice(1);

      rootCause.rca = {
        is_root_cause: true,
        root_cause_id: rootCause.id,
        symptoms: symptoms.map(s => s.id),
        explanation: `Causa raiz identificada cronologicamente em (${rootCause.origin.toUpperCase()}). Sintomas em cascata observados em: ${symptoms.map(s => s.origin.toUpperCase()).join(', ')}.`
      };

      symptoms.forEach(symptom => {
        symptom.rca = {
          is_root_cause: false,
          root_cause_id: rootCause.id,
          symptoms: [],
          explanation: `Sintoma secundário desencadeado pela causa raiz: ${rootCause.message} (ID Causa: ${rootCause.id}).`
        };
        
        // Reduzir severidade do sintoma secundário para evitar alert fatigue em cascata
        if (symptom.severity === 'critical') {
          symptom.severity = 'medium';
          symptom.message = `[SINTOMA EM CASCATA] ${symptom.message}`;
        }
      });
    });

    // Passo 3: Aplicar ML Insights e Alert Fatigue Tuning
    incidents.forEach(incident => {
      let patternKey = `${incident.origin}_${incident.message}`;
      const learned = this.learnedPatterns.get(patternKey) || { count: 0, weight: 0.5 };

      // Se ocorrer muitas vezes sem reincidência de alteração, decrementa a probabilidade de falso positivo
      const isKnown = learned.count >= 2;
      const falsePositiveProb = isKnown ? Math.max(0.05, 0.5 - (learned.weight * 0.4)) : 0.35;

      incident.ml_insights = {
        learned_pattern_detected: isKnown,
        alert_sensitivity_offset: isKnown ? "Fadiga reduzida em 30% (padrão conhecido)" : "Sensibilidade padrão ativa",
        false_positive_probability: Math.round(falsePositiveProb * 100) / 100
      };

      // Se for um falso positivo provável ou recorrente sem impacto, atenua fadiga
      if (isKnown && falsePositiveProb < 0.2 && incident.severity === 'medium') {
        incident.severity = 'low';
        incident.message = `[FATIGA ATENUADA] ${incident.message}`;
      }
    });

    return incidents;
  }
}

export const AIOpsCore = new AIOpsCoreService();
