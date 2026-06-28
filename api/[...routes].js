import crypto from 'crypto';
import https from 'https';
import { BillingEngine } from '../lib/billing/engine.js';
import { PLAN_PREMIUM_MONTHLY_PRICE } from '../lib/billing/config.js';

// Forçar TLS 1.2 ou superior em todas as conexões HTTPS globais realizadas pelo Node.js
https.globalAgent.options.minVersion = 'TLSv1.2';

import { supabaseAdmin } from '../lib/supabase.js';
import { PaymentGateway } from '../lib/paymentGateway/index.js';
import handleUnifiedAsaasWebhook from './billing/asaas-webhook.js';
import handleBillingExpirationCron from './cron/billing-expiration.js';
import { runBillingSanityCheck } from '../jobs/billing-sanity-check.js';
import { withAdminAuth } from '../lib/auth/withAdminAuth.js';
import { logPaymentEvent } from '../lib/payment-logger.js';
import { billingController } from '../server/modules/billing/billing.controller.js';
import { billingControllerV2 } from '../server/modules/billing/v2/billing.controller.v2.js';


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

// [LEGACY MERCADO PAGO REMOVED]

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
                        idempotency_key: deterministicRef,
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
const handleAdminBillingHealthV2 = withAdminAuth((req, res) => billingControllerV2.getHealthV2(req, res));
const handleAdminBillingAnomaliesV2 = withAdminAuth((req, res) => billingControllerV2.getAnomaliesV2(req, res));
const handleAdminBillingForecastV2 = withAdminAuth((req, res) => billingControllerV2.getForecastV2(req, res));
const handleAdminBillingReplayV2 = withAdminAuth((req, res) => billingControllerV2.postReplayV2(req, res));

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

    const route = Array.isArray(req.query.routes) ? req.query.routes.join('/') : (req.query.routes || ''); // [cite: 288, 289]
    const blockedPatterns = ['.env', '.git', 'config', 'secrets', 'credentials']; // [cite: 290]
    if (blockedPatterns.some(p => route.toLowerCase().includes(p))) return res.status(403).json({ error: 'Acesso negado.' }); // [cite: 291, 292]

    try {
        if (route === 'subscription/create') {
            await handleSubscriptionCreate(req, res);
        } else if (route === 'subscription/status') {
            await handleSubscriptionStatus(req, res);
        } else if (route === 'subscription/sync') {
            await handleSubscriptionSync(req, res);
        } else if (route === 'billing/asaas-webhook' || route === 'webhooks/asaas' || route === 'webhook/asaas') {
            await handleUnifiedAsaasWebhook(req, res);
        } else if (route === 'cron/billing-expiration') {
            await handleBillingExpirationCron(req, res);
        } else if (route === 'cron/billing-sanity-check') {
            const result = await runBillingSanityCheck();
            return res.status(200).json(result);

        } else if (route === 'access/check' || route === 'auth/check-access') {
            await handleAccessCheck(req, res);
        } else if (route === 'payments/create' || route === 'payments/pix') {
            await handleSubscriptionCreate(req, res);
        } else if (route === 'analytics/revenue') {
            await handleAnalyticsRevenue(req, res);
        } else if (route === 'analytics/user-timeline') {
            await handleAnalyticsUserTimeline(req, res);
        } else if (route === 'analytics/revenue-integrity') {
            await handleAnalyticsRevenueIntegrity(req, res);
        } else if (route === 'payment-events/log') {
            await handlePaymentEventsLog(req, res);
        } else if (route === 'admin/dashboard') {
            await handleAdminDashboard(req, res);
        } else if (route === 'admin/billing/health/v2') {
            await handleAdminBillingHealthV2(req, res);
        } else if (route === 'admin/billing/anomalies/v2') {
            await handleAdminBillingAnomaliesV2(req, res);
        } else if (route === 'admin/billing/forecast/v2') {
            await handleAdminBillingForecastV2(req, res);
        } else if (route === 'admin/billing/replay/v2') {
            await handleAdminBillingReplayV2(req, res);
        } else if (route === 'admin/billing/health') {
            await handleAdminBillingHealth(req, res);
        } else if (route === 'admin/payment-events' || route === 'admin/billing/timeline' || route.startsWith('admin/billing/user')) {
            await handleAdminBillingTimeline(req, res);
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