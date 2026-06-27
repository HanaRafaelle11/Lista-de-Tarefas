import crypto from 'crypto';
import https from 'https';

// Forçar TLS 1.2 ou superior em todas as conexões HTTPS globais realizadas pelo Node.js
https.globalAgent.options.minVersion = 'TLSv1.2';

import { supabaseAdmin } from '../lib/supabase.js';
import { PaymentGateway } from '../lib/paymentGateway/index.js';
import { handleAsaasWebhook } from './webhooks/asaas.js';
import handleUnifiedAsaasWebhook from './billing/asaas-webhook.js';
import handleBillingExpirationCron from './cron/billing-expiration.js';
import { withAdminAuth } from '../lib/auth/withAdminAuth.js';


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
// normalizeStatus — MANTIDA (fluxo legado de pagamentos)
// =========================================================

const normalizeStatus = (status) => {
    const mapping = {
        'approved': 'approved',
        'authorized': 'approved',
        'in_process': 'in_process',
        'in_mediation': 'in_process',
        'pending': 'pending',
        'rejected': 'rejected',
        'cancelled': 'cancelled',
        'refunded': 'refunded',
        'charged_back': 'refunded' // [cite: 8]
    };
    return mapping[status] || 'pending';
};

// =========================================================
// normalizeSubscriptionStatus — NOVA (fluxo de assinaturas)
// Persiste o status exato retornado pelo Mercado Pago.
// Não assume nenhum status como default de sandbox.
// =========================================================

const subscriptionStatusMap = {
    'authorized': 'active',
    'paused': 'paused',
    'cancelled': 'canceled',
    'expired': 'expired',
    'payment_required': 'payment_required',
    'pending': 'pending'
};
const normalizeSubscriptionStatus = (status) => {
    if (!status) return null; // [cite: 11]
    const normalized = subscriptionStatusMap[status];
    if (!normalized) { // [cite: 12]
        console.warn(`[normalizeSubscriptionStatus] Status desconhecido do MP: "${status}" — preservando como recebido.`); // [cite: 12]
        return status; // preserva status desconhecido em vez de assumir valor padrão [cite: 13]
    }
    return normalized;
};

// =========================================================
// MÁQUINA DE ESTADOS — LEGACY PAYMENT FLOW
// =========================================================

// LEGACY PAYMENT FLOW
const PaymentStateMachine = {
    transitions: {
        'created': ['approved', 'pending', 'rejected', 'cancelled', 'in_process'],
        'pending': ['approved', 'rejected', 'cancelled', 'in_process'],
        'in_process': ['approved', 'rejected', 'cancelled'],
        'approved': ['refunded', 'charged_back'],
        'rejected': [],
        'cancelled': []
    },
    transition(current, next) {
        const allowed = this.transitions[current] || []; // [cite: 15]
        if (allowed.includes(next) || current === next) return next;
        console.warn('[PaymentStateMachine] Transição inválida de ' + current + ' para ' + next); // [cite: 16]
        return next;
    }
};

// =========================================================
// BillingEngine — LEGACY PAYMENT FLOW
// Mantido para compatibilidade com webhooks de pagamentos
// avulsos anteriores à migração para assinaturas.
// NÃO usar para novos fluxos. Use SubscriptionBillingEngine.
// =========================================================

// LEGACY PAYMENT FLOW
const BillingEngine = {
    async handlePaymentApproved(userId, customerId, paymentIdStr, paymentResult) {
        if (!userId) return;
        const now = new Date(); // [cite: 19]
        const d = new Date();
        d.setDate(d.getDate() + 30);
        const expiresAt = d.toISOString();
        // LEGACY PAYMENT FLOW — billing_events insert
        await supabaseAdmin.from('billing_events').insert([{
            user_id: userId,
            type: 'payment_success',
            status: 'approved',
            amount: paymentResult.transaction_amount || 14.90,
            currency: 'BRL',
            provider: 'mercadopago',
            metadata: { payment_id: paymentIdStr, date_approved: now.toISOString() }, // [cite: 21]
            created_at: now.toISOString()
        }]);
        // LEGACY PAYMENT FLOW — profiles update
        await supabaseAdmin.from('profiles').update({
            plano: 'premium',
            assinatura_status: 'active',
            assinatura_inicio: now.toISOString(),
            assinatura_expira_em: expiresAt,
            mercadopago_customer_id: customerId || null,
            updated_at: now.toISOString()
        }).eq('id', userId); // [cite: 23]

        // LEGACY PAYMENT FLOW — subscriptions upsert
        await supabaseAdmin.from('subscriptions').upsert({
            user_id: userId,
            status: 'active',
            plan: 'premium',
            price: 14.90,
            current_period_start: now.toISOString(),
            current_period_end: expiresAt,
            last_payment_id: paymentIdStr, // [cite: 24]
            provider: 'mercado_pago',
            updated_at: now.toISOString()
        }, { onConflict: 'user_id' });
    }
};

// =========================================================
// SubscriptionBillingEngine — NOVO
// Gerencia todo o ciclo de vida de assinaturas recorrentes
// via Mercado Pago Preapproval API.
// =========================================================

const SubscriptionBillingEngine = {

    // Registra evento na tabela subscription_logs
    async logEvent(mpSubscriptionId, eventType, payload) {
        try {
            await supabaseAdmin.from('subscription_logs').insert([{
                subscription_id: mpSubscriptionId || null,
                event_type: eventType,
                payload: payload || {},
                created_at: new Date().toISOString() // [cite: 27]
            }]);
        } catch (logErr) { // [cite: 28]
            console.error(`[SubscriptionBillingEngine.logEvent] Falha ao registrar evento "${eventType}":`, logErr.message); // [cite: 28]
        }
    },

    // Ativa premium: status active
    async handleAuthorized(userId, mpSubscriptionId, subscriptionResult) {
        if (!userId || !mpSubscriptionId) return;
        const now = new Date().toISOString(); // [cite: 30]

        const { data: profileBefore } = await supabaseAdmin
            .from('profiles')
            .select('plano')
            .eq('id', userId)
            .maybeSingle();
        const isUpgrading = !profileBefore || profileBefore.plano !== 'premium';

        const nextBillingDate = subscriptionResult.next_payment_date || null;

        console.log('[SUPABASE UPDATE]', {
            user_id: userId,
            update_fields: { plano: 'premium', assinatura_status: 'active', assinatura_inicio: now, assinatura_expira_em: nextBillingDate },
            timestamp: new Date().toISOString()
        });

        // DENORMALIZAÇÃO — fonte de verdade é subscriptions.status
        // profiles.assinatura_status existe apenas para leitura rápida no frontend
        await supabaseAdmin.from('profiles').update({
            plano: 'premium',
            assinatura_status: 'active',
            assinatura_inicio: now,
            assinatura_expira_em: nextBillingDate,
            mercadopago_customer_id: subscriptionResult.payer_id // [cite: 32]
                ? String(subscriptionResult.payer_id)
                : null,
            updated_at: now
        }).eq('id', userId);
        await supabaseAdmin.from('subscriptions').upsert({ // [cite: 33]
            user_id: userId,
            mp_subscription_id: mpSubscriptionId,
            status: 'active',
            plan: 'premium',
            amount: 14.90,
            next_billing_date: nextBillingDate,
            payer_id: subscriptionResult.payer_id // [cite: 33]
                ? String(subscriptionResult.payer_id) // [cite: 34]
                : null,
            provider: 'mercado_pago',
            updated_at: now
        }, { onConflict: 'user_id' });

        console.log('[PLAN UPDATED]', {
            user_id: userId,
            plan_before: profileBefore?.plano || 'free',
            plan_after: 'premium',
            timestamp: new Date().toISOString()
        });

        try {
            await supabaseAdmin.from('events').insert([
                {
                    user_id: userId,
                    event_type: 'payment_received',
                    metadata: { payment_id: mpSubscriptionId },
                    created_at: now
                },
                {
                    user_id: userId,
                    event_type: 'payment_approved',
                    metadata: { payment_id: mpSubscriptionId },
                    created_at: now
                }
            ]);
        } catch (_) {}

        if (isUpgrading) {
            try {
                await supabaseAdmin.from('events').insert([{
                    user_id: userId,
                    event_type: 'user_upgraded',
                    metadata: { payment_id: mpSubscriptionId, from_plan: profileBefore?.plano || 'free', to_plan: 'premium' },
                    created_at: now
                }]);
            } catch (_) {}
        }

        try {
            await supabaseAdmin.from('billing_events').insert([{
                payment_id: mpSubscriptionId,
                user_id: userId,
                status: 'approved',
                created_at: now
            }]);
        } catch (_) {}

        if (isUpgrading) {
            try {
                await supabaseAdmin.from('billing_events').insert([{
                    payment_id: `upg_${mpSubscriptionId}`,
                    user_id: userId,
                    status: 'approved',
                    created_at: now
                }]);
            } catch (_) {}
        }

        await this.logEvent(mpSubscriptionId, 'subscription.authorized', { // [cite: 35]
            user_id: userId,
            next_payment_date: nextBillingDate,
            date_created: subscriptionResult.date_created || now
        });
        console.log(`[SubscriptionBillingEngine] ✅ Premium ATIVADO para userId=${userId} | sub=${mpSubscriptionId}`); // [cite: 36]
    },

    // Renova premium: pagamento recorrente aprovado
    async handlePaymentApproved(userId, mpSubscriptionId, paymentId, amount) {
        if (!userId) return;
        const now = new Date(); // [cite: 37]
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const nextBillingDate = nextMonth.toISOString();
        const nowIso = now.toISOString(); // [cite: 38]

        const paymentStr = paymentId ? String(paymentId) : `pay_${Date.now()}`;
        const { data: profileBefore } = await supabaseAdmin
            .from('profiles')
            .select('plano')
            .eq('id', userId)
            .maybeSingle();
        const isUpgrading = !profileBefore || profileBefore.plano !== 'premium';

        console.log('[SUPABASE UPDATE]', {
            user_id: userId,
            update_fields: { plano: 'premium', assinatura_status: 'active', assinatura_expira_em: nextBillingDate },
            timestamp: new Date().toISOString()
        });

        // DENORMALIZAÇÃO — fonte de verdade é subscriptions.status
        await supabaseAdmin.from('profiles').update({
            plano: 'premium',
            assinatura_status: 'active',
            assinatura_expira_em: nextBillingDate,
            updated_at: nowIso
        }).eq('id', userId);
        await supabaseAdmin.from('subscriptions').upsert({ // [cite: 39]
            user_id: userId,
            mp_subscription_id: mpSubscriptionId,
            status: 'active',
            plan: 'premium',
            amount: amount || 14.90,
            next_billing_date: nextBillingDate,
            last_payment_date: nowIso,
            last_payment_id: paymentStr, // [cite: 40]
            provider: 'mercado_pago',
            updated_at: nowIso
        }, { onConflict: 'user_id' });

        console.log('[PLAN UPDATED]', {
            user_id: userId,
            plan_before: profileBefore?.plano || 'free',
            plan_after: 'premium',
            timestamp: new Date().toISOString()
        });

        try {
            await supabaseAdmin.from('events').insert([
                {
                    user_id: userId,
                    event_type: 'payment_received',
                    metadata: { payment_id: paymentStr, amount },
                    created_at: nowIso
                },
                {
                    user_id: userId,
                    event_type: 'payment_approved',
                    metadata: { payment_id: paymentStr, amount },
                    created_at: nowIso
                }
            ]);
        } catch (_) {}

        if (isUpgrading) {
            try {
                await supabaseAdmin.from('events').insert([{
                    user_id: userId,
                    event_type: 'user_upgraded',
                    metadata: { payment_id: paymentStr, from_plan: profileBefore?.plano || 'free', to_plan: 'premium' },
                    created_at: nowIso
                }]);
            } catch (_) {}
        }

        try {
            await supabaseAdmin.from('billing_events').insert([{
                payment_id: paymentStr,
                user_id: userId,
                status: 'approved',
                created_at: nowIso
            }]);
        } catch (_) {}

        if (isUpgrading) {
            try {
                await supabaseAdmin.from('billing_events').insert([{
                    payment_id: `upg_${paymentStr}`,
                    user_id: userId,
                    status: 'approved',
                    created_at: nowIso
                }]);
            } catch (_) {}
        }

        await this.logEvent(mpSubscriptionId, 'subscription.payment_approved', { // [cite: 41]
            user_id: userId,
            payment_id: paymentStr,
            amount: amount,
            next_billing_date: nextBillingDate
        });
        console.log(`[SubscriptionBillingEngine] 💰 Renovação registrada para userId=${userId} | sub=${mpSubscriptionId}`); // [cite: 42]
    },

    // Suspende acesso: status paused
    async handlePaused(userId, mpSubscriptionId, rawPayload) {
        if (!userId) return;
        const now = new Date().toISOString(); // [cite: 43]

        // DENORMALIZAÇÃO — fonte de verdade é subscriptions.status
        await supabaseAdmin.from('profiles').update({
            assinatura_status: 'paused',
            updated_at: now
        }).eq('id', userId);
        await supabaseAdmin.from('subscriptions').upsert({ // [cite: 44]
            user_id: userId,
            mp_subscription_id: mpSubscriptionId,
            status: 'paused',
            updated_at: now
        }, { onConflict: 'user_id' });
        await this.logEvent(mpSubscriptionId, 'subscription.paused', { // [cite: 45]
            user_id: userId,
            raw: rawPayload
        });
        console.warn(`[SubscriptionBillingEngine] ⏸ Acesso SUSPENSO para userId=${userId} | sub=${mpSubscriptionId}`); // [cite: 46]
    },

    // Cancela acesso: status canceled
    async handleCancelled(userId, mpSubscriptionId, rawPayload) {
        if (!userId) return;
        const now = new Date().toISOString(); // [cite: 47]

        // DENORMALIZAÇÃO — fonte de verdade é subscriptions.status
        await supabaseAdmin.from('profiles').update({
            plano: 'free',
            assinatura_status: 'canceled',
            updated_at: now
        }).eq('id', userId);
        await supabaseAdmin.from('subscriptions').upsert({ // [cite: 48]
            user_id: userId,
            mp_subscription_id: mpSubscriptionId,
            status: 'canceled',
            updated_at: now
        }, { onConflict: 'user_id' });
        await this.logEvent(mpSubscriptionId, 'subscription.cancelled', { // [cite: 49]
            user_id: userId,
            raw: rawPayload
        });
        console.warn(`[SubscriptionBillingEngine] ❌ Acesso CANCELADO para userId=${userId} | sub=${mpSubscriptionId}`); // [cite: 50]
    },

    // Expira acesso: status expired
    async handleExpired(userId, mpSubscriptionId, rawPayload) {
        if (!userId) return;
        const now = new Date().toISOString(); // [cite: 51]

        // DENORMALIZAÇÃO — fonte de verdade é subscriptions.status
        await supabaseAdmin.from('profiles').update({
            plano: 'free',
            assinatura_status: 'expired',
            updated_at: now
        }).eq('id', userId);
        await supabaseAdmin.from('subscriptions').upsert({ // [cite: 52]
            user_id: userId,
            mp_subscription_id: mpSubscriptionId,
            status: 'expired',
            updated_at: now
        }, { onConflict: 'user_id' });
        await this.logEvent(mpSubscriptionId, 'subscription.expired', { // [cite: 53]
            user_id: userId,
            raw: rawPayload
        });
        console.warn(`[SubscriptionBillingEngine] ⌛ Acesso EXPIRADO para userId=${userId} | sub=${mpSubscriptionId}`); // [cite: 54]
    },

    // Cobrança revertida (chargeback em pagamento recorrente)
    async handleChargedBack(userId, mpSubscriptionId, paymentId, rawPayload) {
        if (!userId) return;
        const now = new Date().toISOString(); // [cite: 55]
        const paymentStr = paymentId ? String(paymentId) : `pay_${Date.now()}`;

        console.log('[SUPABASE UPDATE]', {
            user_id: userId,
            update_fields: { plano: 'free', assinatura_status: 'canceled' },
            timestamp: new Date().toISOString()
        });

        // DENORMALIZAÇÃO — fonte de verdade é subscriptions.status
        await supabaseAdmin.from('profiles').update({
            plano: 'free',
            assinatura_status: 'canceled',
            updated_at: now
        }).eq('id', userId);
        await supabaseAdmin.from('subscriptions').upsert({ // [cite: 56]
            user_id: userId,
            mp_subscription_id: mpSubscriptionId,
            status: 'canceled',
            updated_at: now
        }, { onConflict: 'user_id' });

        console.log('[PLAN UPDATED]', {
            user_id: userId,
            plan_before: 'premium',
            plan_after: 'free',
            timestamp: new Date().toISOString()
        });

        try {
            await supabaseAdmin.from('events').insert([
                {
                    user_id: userId,
                    event_type: 'payment_failed',
                    metadata: { payment_id: paymentStr, reason: 'charged_back', raw: rawPayload },
                    created_at: now
                },
                {
                    user_id: userId,
                    event_type: 'user_downgraded',
                    metadata: { payment_id: paymentStr, from_plan: 'premium', to_plan: 'free' },
                    created_at: now
                }
            ]);
        } catch (_) {}

        try {
            await supabaseAdmin.from('billing_events').insert([{
                payment_id: `down_${paymentStr}`,
                user_id: userId,
                status: 'canceled',
                created_at: now
            }]);
        } catch (_) {}

        await this.logEvent(mpSubscriptionId, 'payment.charged_back', { // [cite: 57]
            user_id: userId,
            payment_id: paymentStr,
            raw: rawPayload
        });
        console.error(`[SubscriptionBillingEngine] 🔴 Chargeback detectado para userId=${userId} | sub=${mpSubscriptionId}`); // [cite: 58]
    }
};

// =========================================================
// BillingTracer — stub de monitorização (mantido)
// =========================================================

const BillingTracer = {
    runWithTrace: async (id, fn) => await fn(),
    recordTrace: async () => { }
};

// =========================================================
// MIDDLEWARE: checkPremiumAccess
// =========================================================

async function checkPremiumAccess(userId) {
    if (!userId) return { allowed: false, reason: 'userId ausente' };
    try { // [cite: 61]
        const { data: subscription, error } = await supabaseAdmin
            .from('subscriptions')
            .select('status, mp_subscription_id, next_billing_date')
            .eq('user_id', userId)
            .maybeSingle();
        if (error) { // [cite: 62]
            console.error('[checkPremiumAccess] Erro ao consultar subscriptions:', error.message); // [cite: 62]
            return { allowed: false, reason: 'erro_db' }; // [cite: 63]
        }

        if (!subscription) {
            return { allowed: false, reason: 'sem_assinatura' }; // [cite: 63]
        }

        const allowedStatuses = ['active'];
        const blockedStatuses = ['paused', 'canceled', 'expired', 'pending', 'payment_required'];
        if (allowedStatuses.includes(subscription.status)) { // [cite: 65]
            return {
                allowed: true,
                status: subscription.status,
                mp_subscription_id: subscription.mp_subscription_id,
                next_billing_date: subscription.next_billing_date
            };
        }

        if (blockedStatuses.includes(subscription.status)) { // [cite: 66]
            return {
                allowed: false,
                reason: `status_bloqueado:${subscription.status}`,
                status: subscription.status
            };
        }

        return { allowed: false, reason: `status_desconhecido:${subscription.status}` }; // [cite: 67]
    } catch (err) { // [cite: 68]
        console.error('[checkPremiumAccess] Exceção:', err.message); // [cite: 68]
        return { allowed: false, reason: 'excecao_interna' }; // [cite: 69]
    }
}

// =========================================================
// HANDLER: handleSubscriptionCreate (NOVO)
// =========================================================

async function handleSubscriptionCreate(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
    }

    try {
        const {
            billingType = 'PIX',
            email,
            cpf,
            userId,
            firstName,
            lastName,
            creditCard,
            creditCardHolderInfo
        } = req.body || {};

        if (!userId) { return res.status(400).json({ error: 'userId é obrigatório.' }); }
        if (!email) { return res.status(400).json({ error: 'email é obrigatório.' }); }
        if (!cpf) { return res.status(400).json({ error: 'cpf é obrigatório.' }); }

        const cleanCpf = cpf.replace(/\D/g, '');
        if (cleanCpf.length !== 11) {
            return res.status(400).json({ error: 'CPF inválido. Deve conter 11 dígitos.' });
        }

        let first_name = firstName?.trim() || '';
        let last_name = lastName?.trim() || '';

        if (!first_name || !last_name) {
            try {
                const { data: profile } = await supabaseAdmin
                    .from('profiles')
                    .select('name, nickname')
                    .eq('id', userId)
                    .maybeSingle();
                const fullName = profile?.name || profile?.nickname || '';
                if (fullName) {
                    const parts = fullName.trim().split(/\s+/);
                    if (!first_name) first_name = parts[0] || '';
                    if (!last_name) last_name = parts.slice(1).join(' ') || '';
                }
            } catch (profileErr) {
                console.warn('[handleSubscriptionCreate] Falha ao buscar perfil:', profileErr.message);
            }
        }

        const { data: profileRow } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        const customerId = await PaymentGateway.ensureCustomer(profileRow || { id: userId, name: `${first_name} ${last_name}` }, email, cleanCpf);

        const { data: existingSub } = await supabaseAdmin
            .from('subscriptions')
            .select('asaas_subscription_id, mp_subscription_id, status, next_billing_date')
            .eq('user_id', userId)
            .maybeSingle();

        if (existingSub && (existingSub.status === 'authorized' || existingSub.status === 'active') && (existingSub.asaas_subscription_id || existingSub.mp_subscription_id)) {
            console.log(`[handleSubscriptionCreate] Assinatura já ativa para userId=${userId}`);
            return res.status(200).json({
                success: true,
                alreadyExists: true,
                asaas_subscription_id: existingSub.asaas_subscription_id || existingSub.mp_subscription_id,
                status: 'authorized',
                next_payment_date: existingSub.next_billing_date
            });
        }

        const externalReference = `mfd_premium_${userId}`;
        const typeUpper = String(billingType).toUpperCase();

        if (typeUpper === 'PIX') {
            const pixCharge = await PaymentGateway.createPixCharge({
                customerId,
                amount: 14.90,
                description: 'Plano MyFlowDay Premium ⚡',
                externalReference
            });

            const now = new Date().toISOString();
            await supabaseAdmin.from('subscriptions').upsert({
                user_id: userId,
                asaas_subscription_id: pixCharge.id,
                status: 'pending',
                plan: 'premium',
                amount: 14.90,
                provider: 'asaas',
                gateway: 'asaas',
                updated_at: now
            }, { onConflict: 'user_id' });

            return res.status(200).json({
                success: true,
                paymentMethod: 'pix',
                status: 'pending',
                qr_code: pixCharge.qr_code,
                qr_code_base64: pixCharge.qr_code_base64,
                expirationDate: pixCharge.expirationDate,
                id: pixCharge.id
            });
        } else {
            const subResult = await PaymentGateway.createSubscription({
                customerId,
                amount: 14.90,
                billingType: 'CREDIT_CARD',
                creditCard,
                creditCardHolderInfo: creditCardHolderInfo || { name: `${first_name} ${last_name}`, email, cpfCnpj: cleanCpf },
                externalReference
            });

            const now = new Date().toISOString();
            await supabaseAdmin.from('subscriptions').upsert({
                user_id: userId,
                asaas_subscription_id: subResult.id,
                status: 'active',
                plan: 'premium',
                amount: 14.90,
                provider: 'asaas',
                gateway: 'asaas',
                updated_at: now
            }, { onConflict: 'user_id' });

            await supabaseAdmin.from('profiles').update({
                plano: 'premium',
                assinatura_status: 'active',
                updated_at: now
            }).eq('id', userId);

            return res.status(200).json({
                success: true,
                paymentMethod: 'credit_card',
                status: 'authorized',
                asaas_subscription_id: subResult.id,
                id: subResult.id
            });
        }
    } catch (error) {
        console.error('[handleSubscriptionCreate] Erro crítico:', error);
        return res.status(500).json({
            error: error.message || 'Erro interno ao criar assinatura.'
        });
    }
}


// =========================================================
// HANDLER: handleSubscriptionStatus (NOVO)
// =========================================================

async function handleSubscriptionStatus(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método não permitido. Utilize GET.' }); // [cite: 112]
    }

    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).json({ error: 'userId é obrigatório.' }); // [cite: 113]
    }

    try {
        const access = await checkPremiumAccess(userId); // [cite: 114]
        if (access.allowed) { // [cite: 115]
            return res.status(200).json({
                isPremium: true,
                status: access.status,
                mp_subscription_id: access.mp_subscription_id,
                next_billing_date: access.next_billing_date
            });
        }

        return res.status(200).json({ // [cite: 116]
            isPremium: false,
            status: access.status || null,
            reason: access.reason
        });
    } catch (err) { // [cite: 117]
        console.error('[handleSubscriptionStatus] Erro:', err.message); // [cite: 117]
        return res.status(500).json({ error: 'Erro ao verificar status da assinatura.' }); // [cite: 118]
    }
}

// =========================================================
// VALIDAÇÃO DE ASSINATURA DO WEBHOOK
// =========================================================

function validateMercadoPagoWebhook(req) {
    const signatureEnabled = process.env.MP_VALIDATE_SIGNATURE === 'true';
    if (!signatureEnabled) { // [cite: 119]
        return { valid: true, skipped: true }; // [cite: 120]
    }

    try {
        const xSignature = req.headers['x-signature'] || ''; // [cite: 121]
        const xRequestId = req.headers['x-request-id'] || ''; // [cite: 122]
        const webhookSecret = process.env.MP_WEBHOOK_SECRET || '';
        if (!webhookSecret) { // [cite: 123]
            console.warn('[validateMercadoPagoWebhook] MP_WEBHOOK_SECRET não configurado. Ignorando validação.'); // [cite: 123]
            return { valid: true, skipped: true, reason: 'secret_not_configured' }; // [cite: 124]
        }

        if (!xSignature) {
            console.warn('[validateMercadoPagoWebhook] Header x-signature ausente.');
            return { valid: false, reason: 'missing_x_signature' }; // [cite: 125]
        }

        const parts = {};
        xSignature.split(',').forEach(part => { // [cite: 126]
            const [key, value] = part.split('=');
            if (key && value) parts[key.trim()] = value.trim();
        });
        const { ts, v1 } = parts; // [cite: 127]
        if (!ts || !v1) {
            return { valid: false, reason: 'invalid_x_signature_format' };
        }

        const dataId = req.body?.data?.id || req.body?.id || ''; // [cite: 128]
        const signatureString = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
        const expectedHash = crypto // [cite: 129]
            .createHmac('sha256', webhookSecret)
            .update(signatureString)
            .digest('hex');
        if (expectedHash !== v1) { // [cite: 130]
            console.error('[validateMercadoPagoWebhook] Assinatura inválida!'); // [cite: 130]
            return { valid: false, reason: 'signature_mismatch' }; // [cite: 131]
        }

        return { valid: true, skipped: false };
    } catch (err) { // [cite: 132]
        console.error('[validateMercadoPagoWebhook] Exceção:', err.message); // [cite: 132]
        return { valid: false, reason: 'exception', error: err.message }; // [cite: 133]
    }
}

// =========================================================
// AUX: handleWebhookDuplicate (IDEMPOTÊNCIA PRE/POST LOCK)
// =========================================================
async function handleWebhookDuplicate(res, eventId, preapprovalIdStr) {
    let userId = null;
    try {
        const { data: ledgerRow } = await supabaseAdmin
            .from('payment_ledger')
            .select('user_id')
            .eq('payment_id', preapprovalIdStr)
            .maybeSingle();
        userId = ledgerRow?.user_id || null;
    } catch (_) {}

    if (!userId) {
        try {
            const { data: subRow } = await supabaseAdmin
                .from('subscriptions')
                .select('user_id')
                .eq('mp_subscription_id', preapprovalIdStr)
                .maybeSingle();
            userId = subRow?.user_id || null;
        } catch (_) {}
    }

    if (!userId) {
        try {
            const { data: profileRow } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .eq('mercadopago_customer_id', preapprovalIdStr)
                .maybeSingle();
            userId = profileRow?.id || null;
        } catch (_) {}
    }

    if (userId) {
        try {
            await supabaseAdmin.from('events').insert([{
                user_id: userId,
                event_type: 'payment_ignored_duplicate',
                metadata: { event_id: eventId, payment_id: preapprovalIdStr },
                created_at: new Date().toISOString()
            }]);
        } catch (_) {}
    }

    try {
        await supabaseAdmin.from('payment_ledger').insert([{
            payment_id: preapprovalIdStr,
            event_type: 'webhook_ignored',
            status_raw: 'duplicate',
            status_normalized: 'duplicate',
            user_id: userId,
            payload: { event_id: eventId, reason: 'idempotency' }
        }]);
    } catch (_) {}

    return res.status(200).json({
        message: 'Evento já processado.',
        idempotent: true,
        billingResult: { duplicated: true }
    });
}

// =========================================================
// HANDLER: handleWebhookMercadoPago (BLINDADO)
// =========================================================

async function handleWebhookMercadoPago(req, res) {
    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Método não permitido. Utilize POST.' }); // [cite: 133]
        }

        const requestTraceId = req.headers['x-trace-id'] || crypto.randomUUID(); // [cite: 134]
        const body = req.body || {}; // [cite: 134]
        console.log('[MP WEBHOOK RECEIVED]', {
            headers: req.headers,
            body: body,
            topic: body.topic,
            type: body.type,
            action: body.action,
            resource_id: body.data?.id || body.id,
            timestamp: new Date().toISOString()
        });
        console.log(`[Webhook] Recebido: type=${body.type} | topic=${body.topic} | traceId=${requestTraceId}`); // [cite: 135]

        const signatureCheck = validateMercadoPagoWebhook(req);
        if (!signatureCheck.valid) { // [cite: 136]
            console.error(`[Webhook] Assinatura inválida: ${signatureCheck.reason}`); // [cite: 136]
            await SubscriptionBillingEngine.logEvent(null, 'webhook.signature_rejected', { // [cite: 137]
                reason: signatureCheck.reason,
                type: body.type
            });
            return res.status(401).json({ error: 'Assinatura do webhook inválida.' }); // 
        }

        // Correção definitiva: Declaração no escopo global do handler
        const preapprovalIdStr =
            body?.data?.id ||
            body?.data?.preapproval_id || // [cite: 139]
            body?.id;

        if (!preapprovalIdStr) {
            console.log('[Webhook] preapprovalIdStr ausente, ignorando evento');
            return res.status(200).json({ message: 'Evento ignorado por falta de ID válido.' }); // [cite: 140]
        }

        const eventId = body.id ? String(body.id) : `${body.type || body.topic || 'unknown'}_${preapprovalIdStr}_${body.action || 'event'}`; // [cite: 141, 142]

        try { // [cite: 143]
            const { data: alreadyProcessed } = await supabaseAdmin
                .from('webhook_events')
                .select('id, processed_at')
                .eq('event_id', eventId)
                .maybeSingle();
            if (alreadyProcessed) { // [cite: 144]
                console.log(`[Webhook] Evento já processado (idempotência): eventId=${eventId} | processedAt=${alreadyProcessed.processed_at}`); // [cite: 144]
                return await handleWebhookDuplicate(res, eventId, preapprovalIdStr);
            }
        } catch (_) {}

        const lockKey = `webhook:${preapprovalIdStr}`;
        const { DistributedLock } = await import('../services/distributed-lock.js');

        return await DistributedLock.withLock(lockKey, async () => {
            // Verificar duplicados novamente dentro do lock para concorrência estrita
            try {
                const { data: alreadyProcessed } = await supabaseAdmin
                    .from('webhook_events')
                    .select('id, processed_at')
                    .eq('event_id', eventId)
                    .maybeSingle();
                if (alreadyProcessed) {
                    console.log(`[Webhook] Evento já processado após lock: eventId=${eventId}`);
                    return await handleWebhookDuplicate(res, eventId, preapprovalIdStr);
                }
            } catch (_) {}

            return await BillingTracer.runWithTrace(requestTraceId, async () => {
                // ── Evento de ASSINATURA (preapproval) ──────────────────────────
                if (body.type === 'preapproval' || body.topic === 'preapproval') {

                    console.log('[PAYMENT FETCH FROM MP]', {
                        preapproval_id: preapprovalIdStr,
                        endpoint: 'preapproval',
                        timestamp: new Date().toISOString()
                    });
                    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalIdStr}`, {
                        headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
                    });

                    if (!mpRes.ok) {
                        console.error(`[Webhook] Falha ao buscar preapproval/${preapprovalIdStr}`);
                        await SubscriptionBillingEngine.logEvent(preapprovalIdStr, 'webhook.preapproval.fetch_failed', {
                            http_status: mpRes.status
                        });
                        return res.status(200).json({ message: 'Failed to fetch preapproval from MP.' });
                    }

                    const preapprovalData = await mpRes.json();
                    const subscriptionStatus = normalizeSubscriptionStatus(preapprovalData.status);
                    const externalRef = preapprovalData.external_reference || '';

                    let userId = null;
                    if (externalRef.startsWith('mfd_premium_')) {
                        userId = externalRef.replace('mfd_premium_', '');
                    } else {
                        const { data: subRow } = await supabaseAdmin
                            .from('subscriptions')
                            .select('user_id')
                            .eq('mp_subscription_id', preapprovalIdStr)
                            .maybeSingle();
                        userId = subRow?.user_id || null;
                    }

                    // Prevenção de webhooks fora de ordem
                    const { EventOrderingEngine } = await import('../services/event-ordering-engine.js');
                    const eventTimestamp = preapprovalData.last_modified || preapprovalData.date_created || new Date().toISOString();
                    if (await EventOrderingEngine.isEventOutOfOrder(userId, eventTimestamp)) {
                        console.log(`[Webhook] Evento preapproval ignorado por estar fora de ordem: user=${userId} | eventId=${eventId}`);
                        try {
                            await supabaseAdmin.from('webhook_events').insert([{ event_id: eventId, event_type: body.type, resource_id: preapprovalIdStr, payload: body }]);
                        } catch (_) {}
                        return res.status(200).json({ message: 'Evento ignorado por estar fora de ordem.', ignored: true, billingResult: { ignored: true } });
                    }

                    const now = new Date().toISOString();
                    await supabaseAdmin.from('subscriptions').upsert({
                        user_id: userId,
                        mp_subscription_id: preapprovalIdStr,
                        status: subscriptionStatus,
                        last_webhook_at: now,
                        webhook_payload: preapprovalData,
                        updated_at: now
                    }, { onConflict: 'mp_subscription_id' });

                    if (subscriptionStatus === 'active') {
                        await SubscriptionBillingEngine.handleAuthorized(userId, preapprovalIdStr, preapprovalData);
                    } else if (subscriptionStatus === 'paused') {
                        await SubscriptionBillingEngine.handlePaused(userId, preapprovalIdStr, preapprovalData);
                    } else if (subscriptionStatus === 'canceled') {
                        await SubscriptionBillingEngine.handleCancelled(userId, preapprovalIdStr, preapprovalData);
                    } else if (subscriptionStatus === 'expired') {
                        await SubscriptionBillingEngine.handleExpired(userId, preapprovalIdStr, preapprovalData);
                    } else {
                        await SubscriptionBillingEngine.logEvent(preapprovalIdStr, `preapproval.${subscriptionStatus || 'unknown'}`, {
                            user_id: userId,
                            mp_status: preapprovalData.status,
                            raw: preapprovalData
                        });
                        console.warn(`[Webhook] Status de preapproval não mapeado: ${preapprovalData.status}`);
                    }

                    try {
                        await supabaseAdmin.from('webhook_events').insert([{
                            event_id: eventId,
                            event_type: body.type || 'preapproval',
                            resource_id: preapprovalIdStr,
                            payload: body
                        }]);
                    } catch (e) {
                        console.warn('[Webhook] Não foi possível salvar webhook_events:', e.message);
                    }
                    return res.status(200).json({
                        success: true,
                        event: 'preapproval',
                        preapprovalId: preapprovalIdStr,
                        status: subscriptionStatus
                    });
                }

                // Suporte resiliente a eventos payment e action: "payment.updated"
                if (body.type === 'payment' || body.topic === 'payment' || body.action === 'payment.updated') {

                    console.log('[PAYMENT FETCH FROM MP]', {
                        payment_id: preapprovalIdStr,
                        endpoint: 'payment',
                        timestamp: new Date().toISOString()
                    });
                    const mpPayRes = await fetch(`https://api.mercadopago.com/v1/payments/${preapprovalIdStr}`, {
                        headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
                    });
                    if (!mpPayRes.ok) {
                        await SubscriptionBillingEngine.logEvent(null, 'webhook.payment.fetch_failed', {
                            payment_id: preapprovalIdStr,
                            http_status: mpPayRes.status
                        });
                        return res.status(200).json({ message: 'Failed to fetch payment details.' });
                    }

                    const paymentData = await mpPayRes.json();
                    console.log('[PAYMENT FETCH FROM MP SUCCESS]', {
                        payment_id: preapprovalIdStr,
                        status: paymentData.status,
                        status_detail: paymentData.status_detail,
                        money_release_date: paymentData.money_release_date,
                        timestamp: new Date().toISOString()
                    });
                    const paymentStatus = normalizeStatus(paymentData.status);

                    let userId = paymentData.metadata?.user_id || null;
                    const externalRef = paymentData.external_reference || '';
                    if (!userId && externalRef.startsWith('mfd_premium_')) {
                        userId = externalRef.replace('mfd_premium_', '');
                    }

                    const mpSubscriptionId = paymentData.preapproval_id ? String(paymentData.preapproval_id) : null;
                    if (!userId && mpSubscriptionId) {
                        const { data: subRow } = await supabaseAdmin
                            .from('subscriptions')
                            .select('user_id')
                            .eq('mp_subscription_id', mpSubscriptionId)
                            .maybeSingle();
                        userId = subRow?.user_id || null;
                    }

                    // Prevenção de webhooks fora de ordem
                    const { EventOrderingEngine } = await import('../services/event-ordering-engine.js');
                    const eventTimestamp = paymentData.date_last_updated || paymentData.date_approved || new Date().toISOString();
                    if (await EventOrderingEngine.isEventOutOfOrder(userId, eventTimestamp)) {
                        console.log(`[Webhook] Evento payment ignorado por estar fora de ordem: user=${userId} | eventId=${eventId}`);
                        try {
                            await supabaseAdmin.from('webhook_events').insert([{ event_id: eventId, event_type: body.type, resource_id: preapprovalIdStr, payload: body }]);
                        } catch (_) {}
                        return res.status(200).json({ message: 'Evento ignorado por estar fora de ordem.', ignored: true, billingResult: { ignored: true } });
                    }

                    // Registrar recebimento no ledger
                    try {
                        await supabaseAdmin.from('payment_ledger').insert([
                            {
                                payment_id: preapprovalIdStr,
                                event_type: 'webhook_received',
                                status_raw: paymentData.status,
                                status_normalized: paymentStatus,
                                user_id: userId,
                                payload: paymentData
                            },
                            {
                                payment_id: preapprovalIdStr,
                                event_type: 'payment_created',
                                status_raw: paymentData.status,
                                status_normalized: paymentStatus,
                                user_id: userId,
                                payload: paymentData
                            },
                            {
                                payment_id: preapprovalIdStr,
                                event_type: 'payment_received',
                                status_raw: paymentData.status,
                                status_normalized: paymentStatus,
                                user_id: userId,
                                payload: paymentData
                            }
                        ]);
                    } catch (_) {}

                    await SubscriptionBillingEngine.logEvent(
                        mpSubscriptionId,
                        `payment.${paymentData.status || 'unknown'}`,
                        {
                            payment_id: preapprovalIdStr,
                            user_id: userId,
                            status: paymentData.status,
                            status_detail: paymentData.status_detail,
                            transaction_amount: paymentData.transaction_amount,
                            date_approved: paymentData.date_approved,
                            preapproval_id: mpSubscriptionId
                        }
                    );
                    if (mpSubscriptionId) {
                        await supabaseAdmin.from('subscriptions')
                            .update({
                                last_webhook_at: new Date().toISOString(),
                                last_payment_date: paymentData.date_approved || new Date().toISOString()
                            })
                            .eq('mp_subscription_id', mpSubscriptionId);
                    }

                    if (paymentStatus === 'approved' && userId) {
                        try {
                            await supabaseAdmin.from('payment_ledger').insert([
                                {
                                    payment_id: preapprovalIdStr,
                                    event_type: 'payment_approved',
                                    status_raw: paymentData.status,
                                    status_normalized: 'approved',
                                    user_id: userId,
                                    payload: paymentData
                                },
                                {
                                    payment_id: preapprovalIdStr,
                                    event_type: 'status_updated',
                                    status_raw: paymentData.status,
                                    status_normalized: 'approved',
                                    user_id: userId,
                                    payload: { new_status: 'active' }
                                }
                            ]);
                        } catch (_) {}
                        await SubscriptionBillingEngine.handlePaymentApproved(
                            userId,
                            mpSubscriptionId,
                            preapprovalIdStr,
                            paymentData.transaction_amount
                        );
                    } else if (paymentStatus === 'refunded' && userId) {
                        await SubscriptionBillingEngine.handleChargedBack(userId, mpSubscriptionId, preapprovalIdStr, paymentData);
                    } else if ((paymentStatus === 'rejected' || paymentStatus === 'cancelled') && userId) {
                        try {
                            await supabaseAdmin.from('payment_ledger').insert([{
                                payment_id: preapprovalIdStr,
                                event_type: 'payment_failed',
                                status_raw: paymentData.status,
                                status_normalized: paymentStatus,
                                user_id: userId,
                                payload: paymentData
                            }]);
                        } catch (_) {}
                        await supabaseAdmin.from('subscriptions')
                            .update({ status: 'past_due', updated_at: new Date().toISOString() })
                            .eq('user_id', userId);
                        await supabaseAdmin.from('profiles')
                            .update({ assinatura_status: 'past_due', updated_at: new Date().toISOString() })
                            .eq('id', userId);
                        await SubscriptionBillingEngine.logEvent(mpSubscriptionId, 'payment.failed_transition_past_due', {
                            payment_id: preapprovalIdStr,
                            user_id: userId,
                            status: paymentData.status
                        });
                    } else {
                        console.warn(`[Webhook] Payment ${preapprovalIdStr} com status="${paymentData.status}" — sem ação.`);
                    }

                    try {
                        await supabaseAdmin.from('webhook_events').insert([{
                            event_id: eventId,
                            event_type: body.type || 'payment',
                            resource_id: preapprovalIdStr,
                            payload: body
                        }]);
                    } catch (e) {
                        console.warn('[Webhook] Não foi possível salvar webhook_events:', e.message);
                    }
                    return res.status(200).json({
                        success: true,
                        event: 'payment',
                        paymentId: preapprovalIdStr,
                        status: paymentData.status
                    });
                }

                // Fallback para layouts desconhecidos
                await SubscriptionBillingEngine.logEvent(null, `webhook.unknown.${body.type || 'no_type'}`, { body });
                console.warn(`[Webhook] Evento não reconhecido: type=${body.type} topic=${body.topic}`);

                try {
                    await supabaseAdmin.from('webhook_events').insert([{ event_id: eventId, event_type: body.type || body.topic || 'unknown', resource_id: preapprovalIdStr, payload: body }]);
                } catch (_) {}
                return res.status(200).json({ message: 'Evento recebido de forma genérica.' });
            });
        }, { lockTimeoutMs: 10000, acquireTimeoutMs: 5000 });
    } catch (webhookErr) { // [cite: 191]
        console.error('[Webhook Critical Error] Erro capturado no wrapper global:', webhookErr); // [cite: 191]
        try { // [cite: 192]
            await SubscriptionBillingEngine.logEvent(null, 'webhook.critical_error', {
                error: webhookErr.message,
                body: req.body
            });
        } catch (_) { }

        return res.status(200).json({
            error: true,
            message: 'Erro processado com status 200 de segurança para conter retries.'
        });
    }
}

// =========================================================
// HANDLER: handlePaymentsCreate — LEGACY PAYMENT FLOW (CORRIGIDO)
// =========================================================

async function handlePaymentsCreate(req, res, routePath) {
    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Método não permitido. Utilize POST.' }); // [cite: 194]
        }

        const { userId, email: emailRoot, amount, payment_method_id, token, installments, cpf: cpfRoot, deviceId, external_reference, metadata, payer } = req.body || {}; // [cite: 195, 196]
        const idempotencyKey = req.headers['x-idempotency-key'] || crypto.randomUUID();

        if (!userId) {
            return res.status(400).json({ error: 'userId é obrigatório.' });
        }

        if (!payment_method_id) {
            return res.status(400).json({ error: 'payment_method_id é obrigatório.' });
        }

        if (payment_method_id !== 'pix' && !token) {
            return res.status(400).json({ error: 'token é obrigatório para pagamentos com cartão.' });
        }

        let email = emailRoot || payer?.email || '';
        if (!email || email.trim() === '' || email === 'test_user@test.com' || email.toLowerCase() === 'null' || email.toLowerCase() === 'undefined') {
            try {
                const authRes = await supabaseAdmin.auth.admin.getUserById(userId);
                console.log('--- DEBUG AUTH LOOKUP ---', { userId, authRes });
                email = authRes?.data?.user?.email;
            } catch (err) {
                console.warn('[API Create] Failed fetching email from Auth:', err.message);
            }
        }

        if (!email || email.trim() === '' || email === 'test_user@test.com' || email.toLowerCase() === 'null' || email.toLowerCase() === 'undefined') {
            return res.status(400).json({ error: 'Email obrigatório.' });
        }

        const cpf = cpfRoot || payer?.identification?.number || '';
        if (!cpf) {
            return res.status(400).json({ error: 'CPF é obrigatório.' });
        }

        const cleanCpf = cpf.replace(/\D/g, '');
        if (cleanCpf.length !== 11) {
            return res.status(400).json({ error: 'CPF deve conter exatamente 11 dígitos.' });
        }

        if (!validateCpf(cleanCpf)) {
            return res.status(400).json({ error: 'CPF inválido.' });
        }

        const payerFirstName = payer?.first_name || '';
        const payerLastName = payer?.last_name || '';
        let first_name = payerFirstName; // [cite: 200]
        let last_name = payerLastName;

        if (!first_name || !last_name) {
            try {
                const { data: profile } = await supabaseAdmin.from('profiles').select('name, nickname').eq('id', userId).maybeSingle(); // [cite: 200, 201]
                const fullName = profile?.name || profile?.nickname; // [cite: 202]
                if (fullName) {
                    const parts = fullName.trim().split(/\s+/);
                    first_name = first_name || parts[0] || ''; // [cite: 203]
                    last_name = last_name || parts.slice(1).join(' ') || ''; // [cite: 203]
                }
            } catch (err) {
                console.warn(`[LEGACY] Falha ao procurar perfil:`, err.message); // [cite: 204]
            }
        }

        if (!first_name || !last_name || isGenericName(first_name) || isGenericName(last_name)) {
            return res.status(400).json({ error: 'Nome e sobrenome válidos são obrigatórios para prosseguir.' }); // [cite: 205]
        }

        const finalAmount = Number(amount) || 14.90;
        const uniqueTimestamp = new Date().getTime();
        const payerForPix = { email: email.trim(), entity_type: 'individual', identification: { type: 'CPF', number: cleanCpf } }; // [cite: 207]
        const payerForCard = { email: email.trim(), entity_type: 'individual', first_name: first_name.trim(), last_name: last_name.trim(), identification: { type: 'CPF', number: cleanCpf } }; // [cite: 208]

        // ✨ PAYLOAD ATUALIZADO — Corrige pendências e aumenta o score de integração do MP (73+)
        const payload = { // [cite: 209]
            transaction_amount: finalAmount,
            payment_method_id: payment_method_id,
            description: 'Plano MyFlowDay Premium',

            // 🎯 Ação Obrigatória: Referência externa mapeada com ID interno único do sistema
            external_reference: external_reference || `order_${userId}_${uniqueTimestamp}`, // [cite: 209, 210]
            statement_descriptor: 'MYFLOWDAY',
            payer: payment_method_id === 'pix' ? payerForPix : payerForCard, // [cite: 210, 211]
            additional_info: {
                items: [{
                    id: 'premium-monthly',
                    title: 'Assinatura MyFlowDay Premium',

                    // 🎯 Ação Recomendada: Descrição rica do item enviada explicitamente para análise antifraude
                    description: 'Acesso completo mensal às ferramentas e relatórios do MyFlowDay Premium',
                    category_id: 'services',
                    quantity: 1,
                    unit_price: finalAmount
                }],
                payer: { first_name: first_name.trim(), last_name: last_name.trim() } // [cite: 212, 213]
            },
            metadata: metadata || { user_id: userId, plan: 'premium' }, // [cite: 213, 214]

            // 🎯 Ação Obrigatória: Envio explícito do endpoint de notificações Webhook de produção
            notification_url: process.env.MP_WEBHOOK_URL || 'https://myflowday.com.br/api/webhooks/mercadopago'
        };

        if (payment_method_id !== 'pix') {
            payload.token = token;
            const resolvedInstallments = Number(installments) || 1; // [cite: 216]
            if (!Number.isInteger(resolvedInstallments) || resolvedInstallments < 1 || resolvedInstallments > 12) {
                return res.status(400).json({ error: 'Invalid installments value' }); // [cite: 216]
            }
            payload.installments = resolvedInstallments; // [cite: 217]
        }

        const mpClient = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN }); // [cite: 218]
        const mpPayment = new MPPayment(mpClient); // [cite: 219]

        console.log('[LEGACY MP Request]:', {
            payment_method: payment_method_id,
            amount: finalAmount,
            has_device_fingerprint: !!deviceId,
            payer_email_masked: email ? email.slice(0, 3) + '***' : 'VAZIO'
        });

        let paymentResult = await mpPayment.create({ // [cite: 220]
            body: payload,
            requestOptions: {
                idempotencyKey,
                ...(deviceId && { customHeaders: { 'X-Meli-Session-Id': deviceId } }) // [cite: 220, 221]
            }
        });

        const maskedResponse = {
            ...paymentResult,
            payer: paymentResult.payer ? { // [cite: 224, 225]
                ...paymentResult.payer,
                email: maskEmail(paymentResult.payer.email),
                identification: paymentResult.payer.identification ? { // [cite: 225, 226]
                    ...paymentResult.payer.identification,
                    number: maskCpf(paymentResult.payer.identification.number)
                } : undefined
            } : undefined
        };

        const paymentIdStr = String(paymentResult.id); // [cite: 227]
        let paymentStatusNormalized = normalizeStatus(paymentResult.status);

        let isForcedPending = false;
        if (payment_method_id === 'pix' && paymentStatusNormalized === 'approved') { // [cite: 228]
            paymentStatusNormalized = 'pending'; // [cite: 228]
            isForcedPending = true; // [cite: 229]
        }

        const { data: existingPayment } = await supabaseAdmin.from('payment_events').select('status').eq('payment_id', paymentIdStr).maybeSingle();
        if (existingPayment && ['approved', 'rejected', 'cancelled', 'refunded', 'charged_back'].includes(existingPayment.status)) { // [cite: 230]
            return res.status(200).json({ success: true, alreadyProcessed: true, status: existingPayment.status }); // [cite: 230]
        }

        await supabaseAdmin.from('payment_ledger').insert([{ payment_id: paymentIdStr, event_type: 'payment_created', status_raw: 'created', status_normalized: 'created', user_id: userId, payload: maskedResponse }]); // [cite: 231]
        await supabaseAdmin.from('payment_events').upsert({ payment_id: paymentIdStr, status: 'created', user_id: userId, plan: 'premium', processed_at: new Date().toISOString(), raw_payload: maskedResponse }, { onConflict: 'payment_id' }); // [cite: 232]
        await supabaseAdmin.from('subscriptions').upsert({ user_id: userId, status: 'past_due', plan: 'premium', last_payment_id: paymentIdStr, provider: 'mercado_pago', updated_at: new Date().toISOString() }, { onConflict: 'user_id' }); // [cite: 233]

        if (paymentStatusNormalized === 'approved' && !isForcedPending) {
            await BillingEngine.handlePaymentApproved(userId, paymentResult.payer?.id || null, paymentIdStr, paymentResult); // [cite: 236, 237]
        }

        if (payment_method_id === 'pix') {
            const transactionData = paymentResult.point_of_interaction?.transaction_data || {}; // [cite: 238, 239]
            return res.status(200).json({ success: true, paymentMethod: 'pix', status: paymentStatusNormalized, qr_code: transactionData.qr_code || transactionData.ticket_url || null, qr_code_base64: transactionData.qr_code_base64 || null, id: paymentResult.id }); // [cite: 247, 248]
        }

        return res.status(200).json({ success: true, id: paymentResult.id, status: paymentStatusNormalized }); // [cite: 249]
    } catch (error) { // [cite: 250]
        console.error('[LEGACY] Erro crítico ao processar pagamento:', error); // [cite: 250]
        return res.status(500).json({ error: 'Erro crítico interno ao processar pagamento.', message: error.message }); // [cite: 251]
    }
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
// HANDLER: handleAccessCheck
// =========================================================

async function handleAccessCheck(req, res) {
    const userId = req.method === 'GET' ? req.query.userId : req.body?.userId;

    if (!userId) {
        return res.status(200).json({ isPro: false, reason: 'INVALID', error: 'userId não fornecido.' });
    }

    try {
        const { AccessDecisionEngine } = await import('../services/access-decision-engine.js');
        const { ChurnEngine } = await import('../services/churn-engine.js');

        // 1. Buscar assinatura do usuário no Supabase
        const { data: subscription, error } = await supabaseAdmin
            .from('subscriptions')
            .select('status, current_period_end, plan')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            console.error(`[API Access Check] Erro ao consultar Supabase para user ${userId}:`, error.message);
            return res.status(200).json({ isPro: false, reason: 'INVALID', error: 'Erro ao carregar dados da assinatura.' });
        }

        // 2. Determinar o veredito via AccessDecisionEngine (Fonte Absoluta de Verdade)
        const decision = AccessDecisionEngine.evaluateAccess(subscription);

        // 3. Registrar logs estruturados de auditoria (Observabilidade)
        try {
            await supabaseAdmin.from('events').insert([{
                user_id: userId,
                event_type: 'access_decision_evaluated',
                metadata: {
                    isPro: decision.isPro,
                    reason: decision.reason,
                    plano: subscription?.plan || 'free',
                    status: subscription?.status || 'free',
                    expiresAt: subscription?.current_period_end || null,
                    timestamp: new Date().toISOString()
                }
            }]);
        } catch (err) {}

        const auditEvent = decision.isPro ? 'access_granted' : 'access_denied_reason';
        try {
            await supabaseAdmin.from('events').insert([{
                user_id: userId,
                event_type: auditEvent,
                metadata: {
                    reason: decision.reason,
                    timestamp: new Date().toISOString()
                }
            }]);
        } catch (err) {}

        // 4. Disparar a reavaliação de Churn em background
        let churnData = null;
        try {
            churnData = await ChurnEngine.calculateChurnScore(userId);
        } catch (_) {}

        return res.status(200).json({ 
            isPro: decision.isPro,
            plano: subscription?.plan || 'free',
            status: decision.reason,
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
        } else if (route === 'webhooks/mercadopago' || route === 'webhook/mercadopago') {
            await handleUnifiedAsaasWebhook(req, res);
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