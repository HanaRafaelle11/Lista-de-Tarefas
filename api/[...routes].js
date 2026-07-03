import crypto from 'crypto';
import https from 'https';
import { BillingEngine } from '../lib/billing/engine.js';
import { PLAN_PREMIUM_MONTHLY_PRICE } from '../lib/billing/config.js';

// Forçar TLS 1.2 ou superior em todas as conexões HTTPS globais realizadas pelo Node.js
https.globalAgent.options.minVersion = 'TLSv1.2';

import { supabaseAdmin } from '../lib/supabase.js';
import { PaymentGateway } from '../lib/paymentGateway/index.js';
import handleUnifiedAsaasWebhook from '../api-handlers/billing/asaas-webhook.js';
import { checkBillingExpirations } from '../services/billing.service.js';
import { runBillingSanityCheck } from '../jobs/billing-sanity-check.js';
import { withAdminAuth } from '../lib/auth/withAdminAuth.js';
import { logPaymentEvent } from '../lib/payment-logger.js';
import { billingController } from '../server/modules/billing/billing.controller.js';
import { OpsMetrics } from '../services/ops-metrics.js';


// =========================================================
// UTILITÁRIOS DE SEGURANÇA E MASCARAMENTO
// =========================================================

const maskEmail = (email) => {
    if (!email) return '';
    const [user, domain] = email.split('@'); // [cite: 5]
    return `${user.substring(0, 3)}***@${domain}`;
};

const maskCpf = (cpf) => {
    if (!cpf) return '';
    return `***.${cpf.substring(3, 6)}.${cpf.substring(6, 9)}-**`; // [cite: 6]
};

const isGenericName = (name) => {
    if (!name) return true;
    const genericNames = ['usuario', 'flowday', 'usuario flowday', 'usuarioflowday', 'null', 'undefined'];
    return genericNames.includes(name.toLowerCase().trim()) || name.trim() === '';
};

function validateCpf(cpf) {
    if (!cpf) return false;
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) return false;
    
    if (/^(\d)\1{10}$/.test(cleanCpf)) return false;
    
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cleanCpf.charAt(i)) * (10 - i);
    }
    let rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cleanCpf.charAt(9))) return false;
    
    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(cleanCpf.charAt(i)) * (11 - i);
    }
    rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cleanCpf.charAt(10))) return false;
    
    return true;
}


// =========================================================
// HANDLER: handleSubscriptionSync
// =========================================================

async function handleSubscriptionSync(req, res) {
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Método não permitido. Utilize POST ou GET.' });
    }

    const authHeader = req.headers['authorization'] || '';
    const querySecret = req.query?.secret || '';
    const providedSecret = authHeader ? authHeader.replace('Bearer ', '').trim() : querySecret;
    const syncSecret = process.env.SYNC_SECRET_KEY || process.env.CRON_SECRET || '';

    if (!syncSecret) {
        return res.status(500).json({ error: 'Sync não configurado.' });
    }
    if (providedSecret !== syncSecret) {
        console.warn('[Reconcile Cron] Tentativa de execução não autorizada.');
        return res.status(401).json({ error: 'Não autorizado. Chave secreta inválida.' });
    }

    console.log('[Reconcile Cron] Iniciando auditoria periódica de faturamento (Anti-drift)...');

    // Gravar evento de observabilidade: consistency_check_run
    try {
        const event = {
            event_type: 'consistency_check_run',
            metadata: { timestamp: new Date().toISOString(), trigger: 'cron_job' }
        };
        await supabaseAdmin.from('events').insert([event]);
    } catch (logErr) {
        console.warn('[Reconcile Cron] Falha ao registrar log consistency_check_run:', logErr.message);
    }

    try {
        const { runReconciliation } = await import('../jobs/payment-reconciliation.js');
        const result = await runReconciliation();
        console.log('[Reconcile Cron] Auditoria finalizada. Resultados:', result);

        return res.status(200).json({
            success: result.success,
            paymentsAudited: result.paymentsAudited,
            subscriptionsAudited: result.subscriptionsAudited,
            discrepanciesFixed: result.fixedCount,
            errors: []
        });
    } catch (error) {
        console.error('[Reconcile Cron] Erro grave durante reconciliação:', error);
        return res.status(500).json({
            error: 'Erro interno ao executar reconciliação.',
            message: error.message
        });
    }
}

// =========================================================
// HANDLER: handleSubscriptionCreate
// =========================================================
async function handleSubscriptionCreate(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
    }

    const isDebug = process.env.NODE_ENV === 'development' || req.query?.debug === 'true' || req.query?.debug === '1';
    let currentStep = 'PAYMENT_INIT';

    try {
        const body = req.body || {};
        console.log('[PAYMENT_REQUEST_RECEIVED]', {
            timestamp: new Date().toISOString(),
            route: 'subscription/create',
            body: { ...body, creditCard: body.creditCard ? '[MASKED]' : undefined }
        });

        const { billingType = 'PIX', userId, email, cpf, firstName, lastName, creditCard, creditCardHolderInfo } = body;

        currentStep = 'VALIDATE_INPUTS';
        if (!userId || !email || !cpf) {
            const missing = [];
            if (!userId) missing.push('userId');
            if (!email) missing.push('email');
            if (!cpf) missing.push('cpf');
            console.error('[PAYMENT_VALIDATION_ERROR] Campos obrigatórios ausentes:', missing.join(', '));
            return res.status(400).json({ error: `Campos obrigatórios (${missing.join(', ')}) não fornecidos.` });
        }

        const cleanCpf = cpf.replace(/\D/g, '');
        if (!validateCpf(cleanCpf)) {
            console.error('[PAYMENT_VALIDATION_ERROR] CPF inválido:', cpf);
            return res.status(400).json({ error: 'CPF inválido.' });
        }

        const fullName = `${firstName || ''} ${lastName || ''}`.trim() || 'Usuário MyFlowDay';

        // 1. Garantir cliente no Asaas
        currentStep = 'ENSURE_CUSTOMER';
        const customerId = await PaymentGateway.ensureCustomer({ id: userId, nome: fullName }, email, cleanCpf);
        console.log('[PAYMENT_STEP_SUCCESS] ensureCustomer finalizado:', { userId, customerId });

        if (billingType.toUpperCase() === 'PIX') {
            const todayStr = new Date().toISOString().slice(0, 10);
            const deterministicRef = body.idempotencyKey ? String(body.idempotencyKey).trim() : `mfd_pix_${userId}_${todayStr}`;

            // STRIPE-LIKE PATTERN: Write-First (Registra intenção preliminar no DB antes do Gateway)
            currentStep = 'WRITE_INITIAL_INTENT';
            try {
                await supabaseAdmin
                    .from('subscriptions')
                    .upsert({
                        user_id: userId,
                        status: 'pending',
                        provider: 'asaas',
                        asaas_customer_id: customerId,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_id' });
                console.log('[PAYMENT_WRITE_FIRST_SUCCESS] Intenção de pagamento gravada no DB antes do Gateway.');
            } catch (intentErr) {
                console.warn('[PAYMENT_WRITE_FIRST_WARN] Falha ao gravar intenção preliminar (prossecução resiliente):', intentErr.message);
            }

            // Chamada ao Gateway (Asaas)
            currentStep = 'CREATE_PIX_CHARGE';
            const pixCharge = await PaymentGateway.createPixCharge({
                customerId,
                amount: PLAN_PREMIUM_MONTHLY_PRICE,
                description: 'Plano MyFlowDay Premium ⚡',
                externalReference: deterministicRef
            });
            console.log('[PAYMENT_STEP_SUCCESS] createPixCharge finalizado:', { paymentId: pixCharge.id, externalReference: deterministicRef });

            // Atualização do registro com o paymentId real do gateway (não-bloqueante / resiliente)
            currentStep = 'UPDATE_PENDING_SUBSCRIPTION';
            BillingEngine.createPendingSubscription(userId, {
                providerId: pixCharge.id,
                customerId,
                billingType: 'pix'
            }).catch(err => {
                console.warn('[PAYMENT_ASYNC_PENDING_WARN] Erro ao atualizar providerId no DB em background:', err.message);
            });

            const responseObj = {
                success: true,
                paymentId: pixCharge.id,
                customerId,
                qrCode: pixCharge.qr_code,
                qrCodeBase64: pixCharge.qr_code_base64,
                qr_code: pixCharge.qr_code,
                qr_code_base64: pixCharge.qr_code_base64,
                invoiceUrl: pixCharge.invoiceUrl,
                expirationDate: pixCharge.expirationDate
            };

            if (isDebug) {
                responseObj.debug = { step: 'SUCCESS', customerId, paymentId: pixCharge.id };
            }

            return res.status(200).json(responseObj);
        } else {
            // Cartão de crédito
            currentStep = 'VALIDATE_CARD_INPUTS';
            if (!creditCard || !creditCard.number || !creditCard.holderName) {
                console.error('[PAYMENT_VALIDATION_ERROR] Dados do cartão incompletos:', creditCard);
                return res.status(400).json({ error: 'Dados do cartão de crédito incompletos.' });
            }

            currentStep = 'CREATE_CREDIT_CARD_CHARGE';
            const cardCharge = await PaymentGateway.createCreditCardCharge({
                customerId,
                amount: PLAN_PREMIUM_MONTHLY_PRICE,
                creditCard,
                creditCardHolderInfo: creditCardHolderInfo || { name: creditCard.holderName, email, cpfCnpj: cleanCpf },
                description: 'Plano MyFlowDay Premium ⚡',
                externalReference: `mfd_premium_${userId}`
            });
            console.log('[PAYMENT_STEP_SUCCESS] createCreditCardCharge finalizado:', { paymentId: cardCharge.id, status: cardCharge.status });

            const statusUpper = (cardCharge.status || '').toUpperCase();
            if (statusUpper === 'CONFIRMED' || statusUpper === 'RECEIVED') {
                BillingEngine.processPaymentSuccess({
                    userId,
                    customerId,
                    paymentId: cardCharge.id,
                    billingType: 'credit_card',
                    value: cardCharge.value
                }).catch(err => console.warn('[PAYMENT_ASYNC_CC_SUCCESS_WARN]', err.message));
            } else {
                BillingEngine.createPendingSubscription(userId, {
                    providerId: cardCharge.id,
                    customerId,
                    billingType: 'credit_card'
                }).catch(err => console.warn('[PAYMENT_ASYNC_CC_PENDING_WARN]', err.message));
            }

            const responseObj = {
                success: true,
                paymentId: cardCharge.id,
                status: cardCharge.status,
                invoiceUrl: cardCharge.invoiceUrl
            };

            if (isDebug) {
                responseObj.debug = { step: 'SUCCESS', customerId, paymentId: cardCharge.id, status: cardCharge.status };
            }

            return res.status(200).json(responseObj);
        }
    } catch (error) {
        console.error('[PAYMENT_ERROR_FULL_STACK]', error.stack || error);
        
        const errorMsg = error.message || 'Falha ao processar pagamento.';
        const errResponse = {
            error: errorMsg.includes('Asaas') || errorMsg.includes('Configuração') || errorMsg.includes('CPF') || errorMsg.includes('Dados') ? errorMsg : 'Falha ao processar pagamento.',
            message: errorMsg
        };

        if (isDebug) {
            errResponse.debug = {
                step: currentStep,
                stack: error.stack,
                asaasDetails: error.asaasDetails || null,
                rawResponseBody: error.rawResponseBody || null
            };
        }

        return res.status(500).json(errResponse);
    }
}

async function handleSubscriptionStatus(req, res) {
    const userId = req.method === 'GET' ? req.query.userId : req.body?.userId;
    if (!userId) return res.status(400).json({ error: 'userId é obrigatório.' });

    try {
        const { data: sub } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        return res.status(200).json({ success: true, subscription: sub });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleAccessCheck(req, res) {
    const userId = req.method === 'GET' ? req.query.userId : req.body?.userId;

    if (!userId) {
        return res.status(200).json({ isPro: false, reason: 'INVALID', error: 'userId não fornecido.' });
    }

    try {
        const { AccessDecisionEngine } = await import('../services/access-decision-engine.js');
        const { ChurnEngine } = await import('../services/churn-engine.js');

        const now = new Date().toISOString();
        const { data: subscription, error } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .not('current_period_end', 'is', null)
            .gt('current_period_end', now)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error(`[API Access Check] Erro ao consultar Supabase para user ${userId}:`, error.message);
            return res.status(200).json({ isPro: false, reason: 'INVALID', error: 'Erro ao carregar dados da assinatura.' });
        }

        const isPro = !!subscription;
        const reason = isPro ? 'ACTIVE' : 'FREE';

        if (!isPro) {
            // Log detalhado de debug explicando por que o usuário NÃO é PRO
            const { data: anySub } = await supabaseAdmin
                .from('subscriptions')
                .select('status, current_period_end, updated_at')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            console.log(`[ACCESS CHECK DEBUG] User ${userId} NÃO é PRO. Razão:`, {
                hasSubscriptionRow: !!anySub,
                latestStatus: anySub?.status || 'no_row',
                currentPeriodEnd: anySub?.current_period_end || 'null',
                evaluatedAt: now,
                expired: anySub?.current_period_end ? anySub.current_period_end <= now : 'no_date'
            });
        } else {
            console.log(`[ACCESS CHECK SUCCESS] User ${userId} É PRO ATIVO até ${subscription.current_period_end}`);
        }

        // 3. Registrar logs estruturados de auditoria (Observabilidade)
        try {
            await supabaseAdmin.from('events').insert([{
                user_id: userId,
                event_type: 'access_decision_evaluated',
                metadata: {
                    isPro,
                    reason,
                    plano: isPro ? 'premium' : 'free',
                    status: subscription?.status || 'free',
                    expiresAt: subscription?.current_period_end || null,
                    timestamp: now
                }
            }]);
        } catch (err) {}

        const auditEvent = isPro ? 'access_granted' : 'access_denied_reason';
        try {
            await supabaseAdmin.from('events').insert([{
                user_id: userId,
                event_type: auditEvent,
                metadata: {
                    reason,
                    timestamp: now
                }
            }]);
        } catch (err) {}

        // 4. Disparar a reavaliação de Churn em background
        let churnData = null;
        try {
            churnData = await ChurnEngine.calculateChurnScore(userId);
        } catch (_) {}

        return res.status(200).json({ 
            isPro,
            plano: isPro ? 'premium' : 'free',
            status: reason,
            expiresAt: subscription?.current_period_end || null,
            churn: churnData ? {
                score: churnData.score,
                risk: churnData.risk
            } : null
        });
    } catch (error) {
        console.error(`[API Access Check] Erro crítico para user ${userId}:`, error);
        return res.status(200).json({ 
            isPro: false, 
            reason: 'INVALID',
            error: 'Erro crítico interno ao verificar acesso.',
            message: error.message 
        });
    }
}

const handleAnalyticsRevenue = withAdminAuth(async (req, res) => {
    try {
        const { RevenueAnalyticsService } = await import('../services/revenue-analytics-service.js');
        const metrics = await RevenueAnalyticsService.getRevenueMetrics();
        return res.status(200).json(metrics);
    } catch (error) {
        return res.status(500).json({ error: 'Erro crítico interno ao carregar analytics.', message: error.message });
    }
});

const handleAnalyticsUserTimeline = withAdminAuth(async (req, res) => {
    const targetUserId = req.method === 'GET' ? req.query.targetUserId : req.body?.targetUserId;
    if (!targetUserId) return res.status(400).json({ error: 'targetUserId é obrigatório.' });

    try {
        const { RevenueAnalyticsService } = await import('../services/revenue-analytics-service.js');
        const timelineData = await RevenueAnalyticsService.getUserTimeline(targetUserId);
        if (!timelineData) {
            return res.status(404).json({ error: 'Perfil do usuário alvo não encontrado.' });
        }
        return res.status(200).json(timelineData);
    } catch (error) {
        return res.status(500).json({ error: 'Erro crítico interno ao carregar a timeline do usuário.', message: error.message });
    }
});

const handleAnalyticsRevenueIntegrity = withAdminAuth(async (req, res) => {
    try {
        const { RevenueIntegrityService } = await import('../services/revenue-integrity-service.js');
        const mrr = await RevenueIntegrityService.calculateMRR();
        const churnRate = await RevenueIntegrityService.calculateChurnRate();
        const leakage = await RevenueIntegrityService.detectRevenueLeakage();
        const cohorts = await RevenueIntegrityService.getCohortTracking();

        return res.status(200).json({
            success: true,
            metrics: {
                mrr,
                churnRate,
                leakageCount: leakage.length,
                cohortCount: cohorts.length
            },
            leakage,
            cohorts
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erro crítico interno ao carregar faturamento e integridade.', message: error.message });
    }
});

const handleAdminDashboard = withAdminAuth(async (req, res) => {
    try {
        console.log('[ADMIN DASHBOARD API] Endpoint iniciado por admin autenticado.');
        const { AdminDashboardService } = await import('../services/admin-dashboard-service.js');
        const dashboardData = await AdminDashboardService.getDashboard();
        return res.status(200).json(dashboardData);
    } catch (error) {
        console.error('[ADMIN DASHBOARD API ERROR 500]', error.message, error.stack);
        return res.status(500).json({ 
            error: 'Erro crítico ao gerar admin dashboard.', 
            message: error.message, 
            stack: error.stack,
            name: error.name
        });
    }
});

// =========================================================
// PAYMENT OBSERVABILITY — LOG (frontend → backend)
// POST /api/payment-events/log
// Recebe eventos de checkout do frontend (sem auth extra: userId vem no body)
// =========================================================
async function handlePaymentEventsLog(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
        const { userId, eventType, status, referenceId, sessionId, payload, errorMessage, provider } = req.body || {};
        if (!eventType) return res.status(400).json({ error: 'eventType é obrigatório' });
        await logPaymentEvent({ userId, provider: provider || 'asaas', eventType, status: status || 'pending', referenceId, sessionId, payload, errorMessage });
        return res.status(200).json({ ok: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}

// =========================================================
// PAYMENT OBSERVABILITY — QUERY (admin)
// GET /api/admin/payment-events?userId=xxx
// Protegido por withAdminAuth. Retorna timeline + consistência.
// =========================================================
const handleAdminBillingTimeline = withAdminAuth((req, res) => billingController.getTimeline(req, res));
const handleAdminBillingHealth = withAdminAuth((req, res) => billingController.getHealth(req, res));

// =========================================================
// MÉTODOS DE CONTROLE E AUDITORIA DE LEDGER (STRIPE-LIKE)
// =========================================================
async function handleLedgerHealth(req, res) {
    try {
        if (!supabaseAdmin) {
            return res.status(500).json({ error: 'SupabaseAdmin não configurado.' });
        }

        let totalEvents = 0;
        let eventsLast24h = 0;
        let driftData = null;
        let dbStatus = 'OK';

        // 1. Total de eventos no ledger (tolerante a falha)
        try {
            const { count, error } = await supabaseAdmin
                .from('billing_events')
                .select('*', { count: 'exact', head: true });
            if (!error) totalEvents = count || 0;
        } catch (e) {
            dbStatus = 'DEGRADED';
        }

        // 2. Eventos nas últimas 24h (tolerante a falha)
        try {
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { count, error } = await supabaseAdmin
                .from('billing_events')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', yesterday);
            if (!error) eventsLast24h = count || 0;
        } catch (e) {
            dbStatus = 'DEGRADED';
        }

        // 3. Auditoria de drift/desalinhamento entre subscriptions e user_entitlements (tolerante a falha)
        try {
            const nowIso = new Date().toISOString();
            const { data: activeSubs } = await supabaseAdmin
                .from('subscriptions')
                .select('user_id, current_period_end')
                .eq('status', 'active')
                .gt('current_period_end', nowIso);

            const { data: activeEnts } = await supabaseAdmin
                .from('user_entitlements')
                .select('user_id, valid_until')
                .eq('feature', 'pro_features')
                .eq('status', 'active')
                .gt('valid_until', nowIso);

            const subUsers = new Set((activeSubs || []).map(s => s.user_id));
            const entUsers = new Set((activeEnts || []).map(e => e.user_id));

            const subWithoutEnt = (activeSubs || []).filter(s => !entUsers.has(s.user_id));
            const entWithoutSub = (activeEnts || []).filter(e => !subUsers.has(e.user_id));

            const hasDrift = subWithoutEnt.length > 0 || entWithoutSub.length > 0;
            if (hasDrift && dbStatus === 'OK') {
                dbStatus = 'DEGRADED';
            }

            driftData = {
                activeSubscriptionsCount: subUsers.size,
                activeEntitlementsCount: entUsers.size,
                mismatches: {
                    subscriptionsWithoutEntitlements: subWithoutEnt.map(s => ({ userId: s.user_id, expires: s.current_period_end })),
                    entitlementsWithoutSubscriptions: entWithoutSub.map(e => ({ userId: e.user_id, expires: e.valid_until }))
                }
            };
        } catch (e) {
            dbStatus = 'DEGRADED';
        }

        // 4. Métricas do OpsMetrics
        const duplicateEvents = OpsMetrics.getWebhookMetrics().duplicates_detected;
        const avgDelayMs = OpsMetrics.getAvgProjectionDelay();
        const lastReplay = OpsMetrics.getReplayMetrics();

        return res.status(200).json({
            status: dbStatus,
            total_events: totalEvents,
            events_last_24h: eventsLast24h,
            duplicate_provider_events: duplicateEvents,
            avg_projection_delay_ms: avgDelayMs,
            last_replay: lastReplay,
            drift: driftData
        });
    } catch (error) {
        return res.status(500).json({ status: 'CRITICAL', error: 'Falha crítica ao auditar saúde do ledger.', message: error.message });
    }
}

async function handleIdempotencyMetrics(req, res) {
    try {
        const metrics = OpsMetrics.getIdempotencyMetrics();
        return res.status(200).json(metrics);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleLockMetrics(req, res) {
    try {
        const metrics = OpsMetrics.getLockMetrics();
        return res.status(200).json(metrics);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleReadiness(req, res) {
    const status = {
        billing: 'ok',
        ledger: 'ok',
        auth: 'ok',
        webhooks: 'ok',
        queues: 'ok',
        overall: 'ready'
    };

    try {
        if (!supabaseAdmin) {
            status.overall = 'not_ready';
            return res.status(200).json({ ...status, billing: 'error', ledger: 'error', auth: 'error', webhooks: 'error' });
        }

        // Parallel checks to ensure endpoints perform well
        const checks = await Promise.allSettled([
            supabaseAdmin.from('subscriptions').select('id').limit(1),
            supabaseAdmin.from('billing_events').select('id').limit(1),
            supabaseAdmin.from('webhook_events').select('id').limit(1)
        ]);

        if (checks[0].status === 'rejected' || checks[0].value.error) {
            status.billing = 'error';
        }
        if (checks[1].status === 'rejected' || checks[1].value.error) {
            status.ledger = 'error';
        }
        if (checks[2].status === 'rejected' || checks[2].value.error) {
            status.webhooks = 'error';
        }
        if (!supabaseAdmin.auth) {
            status.auth = 'error';
        }

        if (status.billing === 'error' || status.ledger === 'error' || status.webhooks === 'error' || status.auth === 'error') {
            status.overall = 'not_ready';
        }

        return res.status(200).json(status);
    } catch (err) {
        return res.status(500).json({
            billing: 'error',
            ledger: 'error',
            auth: 'error',
            webhooks: 'error',
            queues: 'error',
            overall: 'not_ready',
            error: err.message
        });
    }
}

const handleLedgerRebuild = withAdminAuth(async (req, res) => {
    try {
        const { BillingEventProjector } = await import('../workers/billing-event-projector.js');
        const force = req.query?.force === 'true' || req.body?.force === true;
        const result = await BillingEventProjector.replayAllEvents({ force });

        if (result && result.warning) {
            return res.status(400).json(result);
        }

        if (result === true) {
            return res.status(200).json({ success: true, message: 'Reconstrução de projeções do ledger concluída.' });
        } else {
            return res.status(500).json({ success: false, message: 'Falha ao reprocessar eventos do ledger.' });
        }
    } catch (error) {
        return res.status(500).json({ error: 'Erro no rebuild do ledger.', message: error.message });
    }
});

let driftCache = null;
let driftCacheTime = 0;
const DRIFT_CACHE_TTL_MS = 60 * 1000; // 60s

const handleSystemAlerts = withAdminAuth(async (req, res) => {
    try {
        if (!supabaseAdmin) {
            return res.status(500).json({ error: 'SupabaseAdmin não configurado.' });
        }

        const rawAlerts = [];

        // 1. Query Security Access Attempts (unauthorized_admin_access) in last 7 days
        try {
            const yesterday = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const { data: securityEvents } = await supabaseAdmin
                .from('events')
                .select('*')
                .eq('event_type', 'unauthorized_admin_access')
                .gte('created_at', yesterday)
                .order('created_at', { ascending: false });

            if (securityEvents && securityEvents.length > 0) {
                securityEvents.forEach(evt => {
                    rawAlerts.push({
                        id: evt.id || `auth_${evt.created_at}`,
                        severity: 'critical',
                        origin: 'auth',
                        message: `Tentativa de acesso bloqueada em rota de administrador (${evt.metadata?.email}).`,
                        payload: evt.metadata,
                        created_at: evt.created_at
                    });
                });
            }
        } catch (e) {
            console.error('Alerts - Auth check failed:', e);
        }

        // 2. Query Webhook / Billing Failures in last 7 days
        try {
            const yesterday = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const { data: webhookErrors } = await supabaseAdmin
                .from('webhook_events')
                .select('*')
                .eq('status', 'error')
                .gte('created_at', yesterday)
                .order('created_at', { ascending: false });

            if (webhookErrors && webhookErrors.length > 0) {
                webhookErrors.forEach(err => {
                    rawAlerts.push({
                        id: err.id || `webhook_${err.created_at}`,
                        severity: 'critical',
                        origin: 'billing',
                        message: `Falha no processamento de webhook da Asaas (ID: ${err.event_id}).`,
                        payload: { event_type: err.event_type, resource_id: err.resource_id, user_id: err.user_id, payload: err.payload },
                        created_at: err.created_at
                    });
                });
            }
        } catch (e) {
            console.error('Alerts - Webhook check failed:', e);
        }

        // 3. Query Billing Events Failures in last 7 days
        try {
            const yesterday = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const { data: billingErrors } = await supabaseAdmin
                .from('billing_events')
                .select('*')
                .eq('status', 'error')
                .gte('created_at', yesterday)
                .order('created_at', { ascending: false });

            if (billingErrors && billingErrors.length > 0) {
                billingErrors.forEach(err => {
                    rawAlerts.push({
                        id: err.id || `billing_${err.created_at}`,
                        severity: 'medium',
                        origin: 'billing',
                        message: `Falha em transação de faturamento (${err.event_type}).`,
                        payload: { user_id: err.user_id, payment_id: err.payment_id, metadata: err.metadata },
                        created_at: err.created_at
                    });
                });
            }
        } catch (e) {
            console.error('Alerts - Billing check failed:', e);
        }

        // 4. Query Sync Queue / Worker Errors in last 7 days
        try {
            const yesterday = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const { data: workerErrors } = await supabaseAdmin
                .from('events')
                .select('*')
                .ilike('event_type', '%error%')
                .gte('created_at', yesterday)
                .order('created_at', { ascending: false });

            if (workerErrors && workerErrors.length > 0) {
                workerErrors.forEach(err => {
                    if (err.event_type !== 'unauthorized_admin_access') {
                        rawAlerts.push({
                            id: err.id || `worker_${err.created_at}`,
                            severity: 'medium',
                            origin: 'sync',
                            message: `Erro registrado no worker ou processador (${err.event_type}).`,
                            payload: { ...err.metadata, event_type: err.event_type },
                            created_at: err.created_at
                        });
                    }
                });
            }
        } catch (e) {
            console.error('Alerts - Worker check failed:', e);
        }

        // 5. Query/Check Ledger Drift in Real Time (with 60s cache limit)
        const nowMs = Date.now();
        let driftAlerts = [];

        if (driftCache && (nowMs - driftCacheTime < DRIFT_CACHE_TTL_MS)) {
            driftAlerts = [...driftCache];
        } else {
            try {
                const nowIso = new Date().toISOString();
                const { data: activeSubs } = await supabaseAdmin
                    .from('subscriptions')
                    .select('user_id, current_period_end, created_at')
                    .eq('status', 'active')
                    .gt('current_period_end', nowIso);

                const { data: activeEnts } = await supabaseAdmin
                    .from('user_entitlements')
                    .select('user_id, valid_until, created_at')
                    .eq('feature', 'pro_features')
                    .eq('status', 'active')
                    .gt('valid_until', nowIso);

                const subUsers = new Set((activeSubs || []).map(s => s.user_id));
                const entUsers = new Set((activeEnts || []).map(e => e.user_id));

                const subWithoutEnt = (activeSubs || []).filter(s => !entUsers.has(s.user_id));
                const entWithoutSub = (activeEnts || []).filter(e => !subUsers.has(e.user_id));

                // Generating User-Level Ledger drift incidents (Deduplication based on drift type + user_id)
                if (subWithoutEnt.length > 0) {
                    subWithoutEnt.forEach(s => {
                        driftAlerts.push({
                            id: `drift_sub_without_ent_${s.user_id}`,
                            severity: 'critical',
                            origin: 'ledger',
                            message: `Drift de Faturamento: Usuário com assinatura ativa no gateway mas sem entitlement Pro (ID: ${s.user_id}).`,
                            payload: { userId: s.user_id, expires: s.current_period_end },
                            created_at: s.created_at || nowIso
                        });
                    });
                }

                if (entWithoutSub.length > 0) {
                    entWithoutSub.forEach(e => {
                        driftAlerts.push({
                            id: `drift_ent_without_sub_${e.user_id}`,
                            severity: 'medium',
                            origin: 'ledger',
                            message: `Drift de Faturamento: Usuário com acesso Pro ativo no Supabase, mas sem assinatura ativa no gateway (ID: ${e.user_id}).`,
                            payload: { userId: e.user_id, expires: e.valid_until },
                            created_at: e.created_at || nowIso
                        });
                    });
                }

                // Update cache
                driftCache = driftAlerts;
                driftCacheTime = nowMs;
            } catch (e) {
                console.error('Alerts - Drift check failed:', e);
            }
        }

        // Deduplication & Aggregation (Spam Control) logic for raw alerts
        const aggregated = new Map();
        for (const alert of rawAlerts) {
            let key = `${alert.origin}_${alert.severity}_`;
            if (alert.origin === 'auth') {
                key += `${alert.payload?.email || 'anon'}_${alert.payload?.path || 'unknown'}`;
            } else if (alert.origin === 'billing') {
                key += `${alert.payload?.event_id || alert.payload?.resource_id || alert.payload?.payment_id || 'unknown'}`;
            } else if (alert.origin === 'sync') {
                key += `${alert.payload?.event_type || 'unknown'}`;
            } else {
                key += `${alert.message}`;
            }

            if (aggregated.has(key)) {
                const existing = aggregated.get(key);
                existing.count = (existing.count || 1) + 1;
                
                // Get earliest first_seen
                if (new Date(alert.created_at) < new Date(existing.first_seen)) {
                    existing.first_seen = alert.created_at;
                }
                // Get newest last_seen
                if (new Date(alert.created_at) > new Date(existing.last_seen)) {
                    existing.last_seen = alert.created_at;
                    existing.created_at = alert.created_at;
                }
                
                if (Array.isArray(existing.payloads)) {
                    existing.payloads.push(alert.payload);
                } else {
                    existing.payloads = [existing.payload, alert.payload];
                }
            } else {
                aggregated.set(key, {
                    ...alert,
                    count: 1,
                    first_seen: alert.created_at,
                    last_seen: alert.created_at
                });
            }
        }

        // Merge aggregated logs with computed drift alerts
        const allIncidents = [
            ...Array.from(aggregated.values()),
            ...driftAlerts.map(d => ({
                ...d,
                count: 1,
                first_seen: d.created_at,
                last_seen: d.created_at
            }))
        ];

        // Apply Dynamic Severity Escalation & Dynamic Decay (Status) Rules
        allIncidents.forEach(incident => {
            // 1. Dynamic Escalation Engine
            if (incident.severity === 'medium' && incident.count >= 5) {
                incident.severity = 'critical';
                incident.message = `[ESCALADO] ${incident.message}`;
            } else if (incident.count >= 15 && incident.severity !== 'critical') {
                incident.severity = 'critical';
                incident.message = `[ESCALADO ALTA FREQUÊNCIA] ${incident.message}`;
            }

            // 2. Alert Decay System (Status: open | stale | resolved)
            const lastSeenMs = new Date(incident.last_seen).getTime();
            const ageMs = nowMs - lastSeenMs;

            if (ageMs <= 4 * 60 * 60 * 1000) {
                incident.status = 'open'; // Less than 4 hours
            } else if (ageMs <= 24 * 60 * 60 * 1000) {
                incident.status = 'stale'; // Between 4 and 24 hours
            } else {
                incident.status = 'resolved'; // Over 24 hours
            }
        });

        // Ordenar: 1. Severity (critical primeiro), 2. last_seen desc
        allIncidents.sort((a, b) => {
            if (a.severity === 'critical' && b.severity !== 'critical') return -1;
            if (a.severity !== 'critical' && b.severity === 'critical') return 1;
            return new Date(b.last_seen) - new Date(a.last_seen);
        });

        return res.status(200).json(allIncidents);
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao consolidar alertas.', message: error.message });
    }
});

// =========================================================
// ROUTER PRINCIPAL
// =========================================================

export default async function handler(req, res) {
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Credentials', 'true'); // [cite: 286]
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,PUT,PATCH,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Idempotency-Key, X-Trace-Id');
    if (req.method === 'OPTIONS') return res.status(200).end(); // [cite: 287]

    let route = Array.isArray(req.query?.routes)
      ? req.query.routes.join('/')
      : typeof req.query?.routes === 'string'
        ? req.query.routes.replace(/^\/+|\/+$/g, '')
        : '';

    if (!route && req.url) {
      const urlPath = req.url.split('?')[0];
      route = urlPath.replace(/^\/?api\//, '').replace(/^\/+|\/+$/g, '');
    }

    const blockedPatterns = ['.env', '.git', 'config', 'secrets', 'credentials']; // [cite: 290]
    if (blockedPatterns.some(p => route.toLowerCase().includes(p))) return res.status(403).json({ error: 'Acesso negado.' }); // [cite: 291, 292]

    try {
        if (route === 'subscription/create') {
            const handleSubCreate = (await import('../api-handlers/billing/create-subscription.js')).default;
            await handleSubCreate(req, res);
        } else if (route === 'subscription/status') {
            const handleSubStatus = (await import('../api-handlers/billing/status.js')).default;
            await handleSubStatus(req, res);
        } else if (route === 'subscription/cancel' || route === 'billing/cancel') {
            const handleSubCancel = (await import('../api-handlers/billing/cancel.js')).default;
            await handleSubCancel(req, res);
        } else if (route === 'subscription/sync') {
            await handleSubscriptionSync(req, res);
        } else if (route === 'billing/asaas-webhook' || route === 'webhooks/asaas' || route === 'webhook/asaas') {
            await handleUnifiedAsaasWebhook(req, res);
        } else if (route === 'cron/billing-expiration') {
            const result = await checkBillingExpirations({ traceId: 'cron_route_' + Date.now() });
            return res.status(200).json(result);
        } else if (route === 'cron/billing-sanity-check') {
            const result = await runBillingSanityCheck();
            return res.status(200).json(result);
        } else if (route === 'workers/worker-loop' || route === 'cron/worker-loop' || route === 'worker-loop') {
            const handleWorker = (await import('../api-handlers/workers/worker-loop.js')).default;
            await handleWorker(req, res);
        } else if (route === 'access/check' || route === 'auth/check-access') {
            const handleAccess = (await import('../api-handlers/auth/access-check.js')).default;
            await handleAccess(req, res);
        } else if (route === 'payments/create' || route === 'payments/pix') {
            const handleSubCreate = (await import('../api-handlers/billing/create-subscription.js')).default;
            await handleSubCreate(req, res);
        } else if (route === 'analytics/revenue') {
            const handleRev = (await import('../api-handlers/analytics/revenue.js')).default;
            await handleRev(req, res);
        } else if (route === 'analytics/user-timeline') {
            await handleAnalyticsUserTimeline(req, res);
        } else if (route === 'analytics/revenue-integrity') {
            await handleAnalyticsRevenueIntegrity(req, res);
        } else if (route === 'payment-events/log') {
            const handlePayLog = (await import('../api-handlers/payments/events-log.js')).default;
            await handlePayLog(req, res);
        } else if (route === 'admin/dashboard') {
            const handleDash = (await import('../api-handlers/admin/dashboard.js')).default;
            await handleDash(req, res);
        } else if (route === 'admin/system-status' || route === 'admin/status') {
            const handleStatus = (await import('../api-handlers/admin/system-status.js')).default;
            await handleStatus(req, res);
        } else if (route === 'admin/growth/intelligence') {
            const handleGrowthIntel = (await import('../api-handlers/admin/growth/intelligence.js')).default;
            await handleGrowthIntel(req, res);
        } else if (route === 'admin/billing/health') {
            await handleAdminBillingHealth(req, res);
        } else if (route === 'push-telemetry') {
            const handlePushTelemetry = (await import('../api-handlers/push-telemetry.js')).default;
            await handlePushTelemetry(req, res);
        } else if (route === 'admin/notifications') {
            const handleAdminNotifs = (await import('../api-handlers/admin/notifications.js')).default;
            await handleAdminNotifs(req, res);
        } else if (route === 'admin/notifications/test-push') {
            const handleTestPush = (await import('../api-handlers/admin/test-push.js')).default;
            await handleTestPush(req, res);
        } else if (route === 'admin/payment-events' || route === 'admin/billing/timeline' || route.startsWith('admin/billing/user')) {
            await handleAdminBillingTimeline(req, res);
        } else if (route === 'admin/system-alerts') {
            await handleSystemAlerts(req, res);
        } else if (route === 'system/ledger-health') {
            await handleLedgerHealth(req, res);
        } else if (route === 'system/idempotency-metrics') {
            await handleIdempotencyMetrics(req, res);
        } else if (route === 'system/lock-metrics') {
            await handleLockMetrics(req, res);
        } else if (route === 'system/readiness') {
            await handleReadiness(req, res);
        } else if (route === 'system/ledger-rebuild') {
            await handleLedgerRebuild(req, res);
        } else if (route === '' || route === 'health') {
            res.status(200).json({ 
                status: 'online', 
                ts: new Date().toISOString(),
                hasAsaasKey: !!process.env.ASAAS_API_KEY,
                asaasEnv: process.env.ASAAS_ENV || 'not_set',
                keyLen: (process.env.ASAAS_API_KEY || '').length
            });
        } else {
            res.status(404).json({ error: `Rota não encontrada: ${route}` });
        }

    } catch (error) {
        res.status(500).json({ error: 'Erro interno.', message: error.message }); // [cite: 301]
    }
}