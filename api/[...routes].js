import crypto from 'crypto'; // [cite: 1]
// NOTA: MPPayment mantido para o fluxo LEGACY de pagamentos avulsos.
// O novo fluxo de assinaturas usa fetch direto à API REST do Mercado Pago.
import { MercadoPagoConfig, Payment as MPPayment } from 'mercadopago'; // [cite: 2, 3]

import { supabaseAdmin } from '../lib/supabase.js';

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
    const genericNames = ['teste', 'test', 'usuario', 'user', 'admin'];
    return genericNames.includes(name.toLowerCase().trim()); // [cite: 7]
};

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
    'authorized': 'authorized',
    'paused': 'paused',
    'cancelled': 'cancelled',
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

    // Ativa premium: status authorized
    async handleAuthorized(userId, mpSubscriptionId, subscriptionResult) {
        if (!userId || !mpSubscriptionId) return;
        const now = new Date().toISOString(); // [cite: 30]

        const nextBillingDate = subscriptionResult.next_payment_date || null;
        // DENORMALIZAÇÃO — fonte de verdade é subscriptions.status
        // profiles.assinatura_status existe apenas para leitura rápida no frontend
        await supabaseAdmin.from('profiles').update({
            plano: 'premium',
            assinatura_status: 'authorized',
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
            status: 'authorized',
            plan: 'premium',
            amount: 14.90,
            next_billing_date: nextBillingDate,
            payer_id: subscriptionResult.payer_id // [cite: 33]
                ? String(subscriptionResult.payer_id) // [cite: 34]
                : null,
            provider: 'mercado_pago',
            updated_at: now
        }, { onConflict: 'user_id' });
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

        // DENORMALIZAÇÃO — fonte de verdade é subscriptions.status
        await supabaseAdmin.from('profiles').update({
            plano: 'premium',
            assinatura_status: 'authorized',
            assinatura_expira_em: nextBillingDate,
            updated_at: nowIso
        }).eq('id', userId);
        await supabaseAdmin.from('subscriptions').upsert({ // [cite: 39]
            user_id: userId,
            mp_subscription_id: mpSubscriptionId,
            status: 'authorized',
            plan: 'premium',
            amount: amount || 14.90,
            next_billing_date: nextBillingDate,
            last_payment_date: nowIso,
            last_payment_id: paymentId ? String(paymentId) : null, // [cite: 40]
            provider: 'mercado_pago',
            updated_at: nowIso
        }, { onConflict: 'user_id' });
        await this.logEvent(mpSubscriptionId, 'subscription.payment_approved', { // [cite: 41]
            user_id: userId,
            payment_id: paymentId,
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

    // Cancela acesso: status cancelled
    async handleCancelled(userId, mpSubscriptionId, rawPayload) {
        if (!userId) return;
        const now = new Date().toISOString(); // [cite: 47]

        // DENORMALIZAÇÃO — fonte de verdade é subscriptions.status
        await supabaseAdmin.from('profiles').update({
            plano: 'free',
            assinatura_status: 'cancelled',
            updated_at: now
        }).eq('id', userId);
        await supabaseAdmin.from('subscriptions').upsert({ // [cite: 48]
            user_id: userId,
            mp_subscription_id: mpSubscriptionId,
            status: 'cancelled',
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

        // DENORMALIZAÇÃO — fonte de verdade é subscriptions.status
        await supabaseAdmin.from('profiles').update({
            assinatura_status: 'paused',
            updated_at: now
        }).eq('id', userId);
        await supabaseAdmin.from('subscriptions').upsert({ // [cite: 56]
            user_id: userId,
            mp_subscription_id: mpSubscriptionId,
            status: 'paused',
            updated_at: now
        }, { onConflict: 'user_id' });
        await this.logEvent(mpSubscriptionId, 'payment.charged_back', { // [cite: 57]
            user_id: userId,
            payment_id: paymentId,
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

        const allowedStatuses = ['authorized'];
        const blockedStatuses = ['paused', 'cancelled', 'expired', 'pending', 'payment_required'];
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
        return res.status(405).json({ error: 'Método não permitido. Utilize POST.' }); // [cite: 69]
    }

    try {
        const {
            card_token_id,
            email,
            cpf,
            userId,
            firstName,
            lastName
        } = req.body || {}; // [cite: 70, 71]

        if (!userId) { return res.status(400).json({ error: 'userId é obrigatório.' }); } // [cite: 71, 72]
        if (!card_token_id) { return res.status(400).json({ error: 'card_token_id é obrigatório.' }); } // [cite: 72, 73]
        if (!email) { return res.status(400).json({ error: 'email é obrigatório.' }); } // [cite: 73, 74]
        if (!cpf) { return res.status(400).json({ error: 'cpf é obrigatório.' }); } // [cite: 74, 75]

        const cleanCpf = cpf.replace(/\D/g, ''); // [cite: 75]
        if (cleanCpf.length !== 11) {
            return res.status(400).json({ error: 'CPF inválido. Deve conter 11 dígitos.' }); // [cite: 76]
        }

        let first_name = firstName?.trim() || ''; // [cite: 77, 78]
        let last_name = lastName?.trim() || ''; // [cite: 78]

        if (!first_name || !last_name) {
            try {
                const { data: profile } = await supabaseAdmin
                    .from('profiles')
                    .select('name, nickname')
                    .eq('id', userId) // [cite: 79]
                    .maybeSingle();
                const fullName = profile?.name || profile?.nickname || ''; // [cite: 80]
                if (fullName) {
                    const parts = fullName.trim().split(/\s+/);
                    if (!first_name) first_name = parts[0] || ''; // [cite: 81]
                    if (!last_name) last_name = parts.slice(1).join(' ') || ''; // [cite: 81]
                }
            } catch (profileErr) {
                console.warn('[handleSubscriptionCreate] Falha ao buscar perfil:', profileErr.message); // [cite: 82]
            }
        }

        if (!first_name || !last_name || isGenericName(first_name) || isGenericName(last_name)) {
            return res.status(400).json({ error: 'Nome e sobrenome válidos são obrigatórios.' }); // [cite: 83]
        }

        const { data: existingSub } = await supabaseAdmin
            .from('subscriptions')
            .select('mp_subscription_id, status, next_billing_date')
            .eq('user_id', userId)
            .maybeSingle();
        if (existingSub && existingSub.status === 'authorized' && existingSub.mp_subscription_id) { // [cite: 85]
            console.log(`[handleSubscriptionCreate] Assinatura já ativa para userId=${userId}`); // [cite: 85]
            return res.status(200).json({ // [cite: 86]
                success: true,
                alreadyExists: true,
                mp_subscription_id: existingSub.mp_subscription_id,
                status: 'authorized',
                next_payment_date: existingSub.next_billing_date
            });
        }

        const preapprovalPayload = {
            reason: 'MyFlowDay Premium',
            back_url: 'https://myflowday.com.br', // 
            payer_email: email.trim(),
            card_token_id: card_token_id,
            status: 'authorized', // [cite: 88]
            auto_recurring: {
                frequency: 1,
                frequency_type: 'months',
                transaction_amount: 14.90,
                currency_id: 'BRL'
            },
            payer: {
                email: email.trim(),
                identification: {
                    type: 'CPF',
                    number: cleanCpf
                }
            },
            external_reference: `mfd_premium_${userId}`,
            notification_url: process.env.MP_WEBHOOK_URL || 'https://myflowday.com.br/api/webhooks/mercadopago' // [cite: 90, 91]
        };

        console.log('[handleSubscriptionCreate] Enviando para /preapproval:', {
            payer_email: maskEmail(email),
            has_token: !!card_token_id,
            cpf: maskCpf(cleanCpf),
            userId: userId
        });
        const idempotencyKey = `subscription_create_${userId}`; // [cite: 92]

        console.log('[MP DEBUG] MP_ACCESS_TOKEN existe?', !!process.env.MP_ACCESS_TOKEN); // [cite: 93]
        console.log('[MP DEBUG] Prefixo token:', process.env.MP_ACCESS_TOKEN?.substring(0, 10)); // [cite: 94]
        console.log('[MP DEBUG] card_token_id:', card_token_id);
        console.log('[MP DEBUG] email:', email);
        console.log('[MP DEBUG] cpf:', cleanCpf);
        console.log('[MP DEBUG] first_name:', first_name); // [cite: 95]
        console.log('[MP DEBUG] last_name:', last_name);
        console.log('[MP DEBUG] preapprovalPayload:', JSON.stringify(preapprovalPayload, null, 2));

        const mpResponse = await fetch('https://api.mercadopago.com/preapproval', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': idempotencyKey // [cite: 97]
            },
            body: JSON.stringify(preapprovalPayload)
        });
        const mpData = await mpResponse.json(); // [cite: 98]

        console.log('[MP DEBUG] HTTP Status:', mpResponse.status);
        console.log('[MP DEBUG] MP Response:', JSON.stringify(mpData, null, 2)); // [cite: 99]

        if (!mpResponse.ok) {
            console.error('[handleSubscriptionCreate] Erro MP:', JSON.stringify(mpData));
            await SubscriptionBillingEngine.logEvent(null, 'subscription.create_failed', { // [cite: 100]
                user_id: userId,
                mp_error: mpData,
                status_code: mpResponse.status
            });
            return res.status(400).json({ // [cite: 101]
                error: mpData.message || 'Falha ao criar assinatura no Mercado Pago.',
                mp_status: mpResponse.status,
                details: mpData
            });
        }

        const mpSubscriptionId = mpData.id;
        const subscriptionStatus = normalizeSubscriptionStatus(mpData.status);
        const nextPaymentDate = mpData.next_payment_date || null; // [cite: 103]
        const payerId = mpData.payer_id ? String(mpData.payer_id) : null;
        const now = new Date().toISOString();
        console.log(`[handleSubscriptionCreate] MP retornou: id=${mpSubscriptionId} status=${subscriptionStatus}`); // [cite: 104]

        const { error: upsertError } = await supabaseAdmin.from('subscriptions').upsert({ // [cite: 105]
            user_id: userId,
            mp_subscription_id: mpSubscriptionId,
            status: 'pending',
            plan: 'premium',
            amount: 14.90,
            next_billing_date: nextPaymentDate, // [cite: 106]
            payer_id: payerId,
            provider: 'mercado_pago',
            webhook_payload: mpData,
            updated_at: now
        }, { onConflict: 'user_id' });
        if (upsertError) { // [cite: 107]
            console.error('[handleSubscriptionCreate] Erro ao salvar no Supabase:', upsertError.message); // [cite: 107]
        }

        await SubscriptionBillingEngine.logEvent(mpSubscriptionId, `subscription.created.${subscriptionStatus}`, {
            user_id: userId,
            mp_status: mpData.status,
            next_payment_date: nextPaymentDate
        });
        return res.status(200).json({ // [cite: 109]
            success: true,
            mp_subscription_id: mpSubscriptionId,
            status: subscriptionStatus,
            next_payment_date: nextPaymentDate,
            date_created: mpData.date_created || now
        });
    } catch (error) { // [cite: 110]
        console.error('[handleSubscriptionCreate] Erro crítico:', error); // [cite: 110]
        return res.status(500).json({ // [cite: 111]
            error: 'Erro interno ao criar assinatura.',
            message: error.message
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
// HANDLER: handleWebhookMercadoPago (BLINDADO)
// =========================================================

async function handleWebhookMercadoPago(req, res) {
    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Método não permitido. Utilize POST.' }); // [cite: 133]
        }

        const requestTraceId = req.headers['x-trace-id'] || crypto.randomUUID(); // [cite: 134]
        const body = req.body || {}; // [cite: 134]
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
                return res.status(200).json({ message: 'Evento já processado.', idempotent: true }); // [cite: 145]
            }
        } catch (idempotencyErr) {
            console.warn('[Webhook] Aviso de idempotência (execute migration v21):', idempotencyErr.message);
        }

        return await BillingTracer.runWithTrace(requestTraceId, async () => {
            // ── Evento de ASSINATURA (preapproval) ──────────────────────────
            if (body.type === 'preapproval' || body.topic === 'preapproval') {

                const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalIdStr}`, {
                    headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` } // [cite: 147]
                });

                if (!mpRes.ok) {
                    console.error(`[Webhook] Falha ao buscar preapproval/${preapprovalIdStr}`);
                    await SubscriptionBillingEngine.logEvent(preapprovalIdStr, 'webhook.preapproval.fetch_failed', { // [cite: 148]
                        http_status: mpRes.status
                    });
                    return res.status(200).json({ message: 'Failed to fetch preapproval from MP.' });
                }

                const preapprovalData = await mpRes.json(); // [cite: 149]
                const subscriptionStatus = normalizeSubscriptionStatus(preapprovalData.status); // [cite: 150]
                const externalRef = preapprovalData.external_reference || '';

                let userId = null;
                if (externalRef.startsWith('mfd_premium_')) { // [cite: 151]
                    userId = externalRef.replace('mfd_premium_', ''); // [cite: 151]
                } else { // [cite: 152]
                    const { data: subRow } = await supabaseAdmin
                        .from('subscriptions')
                        .select('user_id')
                        .eq('mp_subscription_id', preapprovalIdStr) // [cite: 153]
                        .maybeSingle();
                    userId = subRow?.user_id || null; // [cite: 154]
                }

                const now = new Date().toISOString();
                await supabaseAdmin.from('subscriptions').upsert({ // [cite: 155]
                    user_id: userId,
                    mp_subscription_id: preapprovalIdStr,
                    status: subscriptionStatus,
                    last_webhook_at: now,
                    webhook_payload: preapprovalData, // [cite: 156]
                    updated_at: now
                }, { onConflict: 'mp_subscription_id' });

                if (subscriptionStatus === 'authorized') { // [cite: 157]
                    await SubscriptionBillingEngine.handleAuthorized(userId, preapprovalIdStr, preapprovalData); // [cite: 157]
                } else if (subscriptionStatus === 'paused') { // [cite: 158]
                    await SubscriptionBillingEngine.handlePaused(userId, preapprovalIdStr, preapprovalData); // [cite: 158]
                } else if (subscriptionStatus === 'cancelled') { // [cite: 159]
                    await SubscriptionBillingEngine.handleCancelled(userId, preapprovalIdStr, preapprovalData); // [cite: 159]
                } else if (subscriptionStatus === 'expired') { // [cite: 160]
                    await SubscriptionBillingEngine.handleExpired(userId, preapprovalIdStr, preapprovalData); // [cite: 160]
                } else { // [cite: 161]
                    await SubscriptionBillingEngine.logEvent(preapprovalIdStr, `preapproval.${subscriptionStatus || 'unknown'}`, {
                        user_id: userId,
                        mp_status: preapprovalData.status,
                        raw: preapprovalData // [cite: 161]
                    });
                    console.warn(`[Webhook] Status de preapproval não mapeado: ${preapprovalData.status}`); // [cite: 163]
                }

                await supabaseAdmin.from('webhook_events').insert([{
                    event_id: eventId,
                    event_type: body.type || 'preapproval',
                    resource_id: preapprovalIdStr,
                    payload: body // [cite: 164]
                }]).catch((e) => console.warn('[Webhook] Não foi possível salvar webhook_events:', e.message));
                return res.status(200).json({ // [cite: 165]
                    success: true,
                    event: 'preapproval',
                    preapprovalId: preapprovalIdStr,
                    status: subscriptionStatus
                }); // [cite: 166]
            }

            // Suporte resiliente a eventos payment e action: "payment.updated"
            if (body.type === 'payment' || body.topic === 'payment' || body.action === 'payment.updated') {

                const mpPayRes = await fetch(`https://api.mercadopago.com/v1/payments/${preapprovalIdStr}`, {
                    headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` } // [cite: 167]
                });
                if (!mpPayRes.ok) { // [cite: 168]
                    await SubscriptionBillingEngine.logEvent(null, 'webhook.payment.fetch_failed', {
                        payment_id: preapprovalIdStr,
                        http_status: mpPayRes.status
                    });
                    return res.status(200).json({ message: 'Failed to fetch payment details.' }); // [cite: 169]
                }

                const paymentData = await mpPayRes.json();
                const paymentStatus = normalizeStatus(paymentData.status); // [cite: 170]

                let userId = paymentData.metadata?.user_id || null;
                const externalRef = paymentData.external_reference || '';
                if (!userId && externalRef.startsWith('mfd_premium_')) { // [cite: 171]
                    userId = externalRef.replace('mfd_premium_', ''); // [cite: 171]
                }

                const mpSubscriptionId = paymentData.preapproval_id ? String(paymentData.preapproval_id) : null; // [cite: 172, 173]
                if (!userId && mpSubscriptionId) { // [cite: 174]
                    const { data: subRow } = await supabaseAdmin
                        .from('subscriptions')
                        .select('user_id')
                        .eq('mp_subscription_id', mpSubscriptionId) // [cite: 175]
                        .maybeSingle();
                    userId = subRow?.user_id || null; // [cite: 176]
                }

                await SubscriptionBillingEngine.logEvent(
                    mpSubscriptionId,
                    `payment.${paymentData.status || 'unknown'}`,
                    {
                        payment_id: preapprovalIdStr, // [cite: 177]
                        user_id: userId,
                        status: paymentData.status,
                        status_detail: paymentData.status_detail,
                        transaction_amount: paymentData.transaction_amount, // [cite: 178]
                        date_approved: paymentData.date_approved,
                        preapproval_id: mpSubscriptionId
                    }
                );
                if (mpSubscriptionId) { // [cite: 179]
                    await supabaseAdmin.from('subscriptions')
                        .update({
                            last_webhook_at: new Date().toISOString(),
                            last_payment_date: paymentData.date_approved || new Date().toISOString() // [cite: 180]
                        })
                        .eq('mp_subscription_id', mpSubscriptionId);
                }

                if (paymentStatus === 'approved' && userId) {
                    await SubscriptionBillingEngine.handlePaymentApproved(
                        userId,
                        mpSubscriptionId,
                        preapprovalIdStr, // [cite: 182]
                        paymentData.transaction_amount
                    );
                } else if (paymentStatus === 'refunded' && userId) { // [cite: 183]
                    await SubscriptionBillingEngine.handleChargedBack(userId, mpSubscriptionId, preapprovalIdStr, paymentData);
                } else { // [cite: 184]
                    console.warn(`[Webhook] Payment ${preapprovalIdStr} com status="${paymentData.status}" — sem ação.`); // [cite: 184]
                }

                await supabaseAdmin.from('webhook_events').insert([{
                    event_id: eventId,
                    event_type: body.type || 'payment',
                    resource_id: preapprovalIdStr,
                    payload: body // [cite: 186]
                }]).catch((e) => console.warn('[Webhook] Não foi possível salvar webhook_events:', e.message));
                return res.status(200).json({ // [cite: 187]
                    success: true,
                    event: 'payment',
                    paymentId: preapprovalIdStr,
                    status: paymentData.status
                }); // [cite: 188]
            }

            // Fallback para layouts desconhecidos
            await SubscriptionBillingEngine.logEvent(null, `webhook.unknown.${body.type || 'no_type'}`, { body });
            console.warn(`[Webhook] Evento não reconhecido: type=${body.type} topic=${body.topic}`); // [cite: 189]

            await supabaseAdmin.from('webhook_events').insert([{ event_id: eventId, event_type: body.type || body.topic || 'unknown', resource_id: preapprovalIdStr, payload: body }]).catch(() => { });
            return res.status(200).json({ message: 'Evento recebido de forma genérica.' }); // [cite: 190]
        });
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

        const email = emailRoot || payer?.email || '';
        const cpf = cpfRoot || payer?.identification?.number || ''; // [cite: 196, 197]
        const payerFirstName = payer?.first_name || '';
        const payerLastName = payer?.last_name || '';
        if (!userId || !email || !payment_method_id) { // [cite: 198]
            return res.status(400).json({ error: 'Campos obrigatórios em falta: userId, email ou payment_method_id.' }); // [cite: 199]
        }

        const cleanCpf = cpf ? cpf.replace(/\D/g, '') : ''; // [cite: 199]
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

        const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN }); // [cite: 218]
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
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Utilize POST.' }); // [cite: 252]
    }

    const authHeader = req.headers['authorization'] || '';
    const syncSecret = process.env.SYNC_SECRET_KEY || '';
    if (!syncSecret) return res.status(500).json({ error: 'Sync não configurado.' }); // [cite: 254, 255]
    if (authHeader !== `Bearer ${syncSecret}`) return res.status(401).json({ error: 'Não autorizado.' }); // [cite: 255, 256]

    const { userId } = req.body || {}; // [cite: 256]
    const startedAt = new Date().toISOString(); // [cite: 257]
    let cronRunId = null;

    try {
        const { data: cronRun } = await supabaseAdmin.from('cron_runs').insert([{ job_name: 'subscription-sync', started_at: startedAt, status: 'running' }]).select('id').maybeSingle();
        cronRunId = cronRun?.id || null; // [cite: 258]
    } catch (_) { }

    try {
        let subscriptionsToSync = [];
        if (userId) { // [cite: 259]
            const { data } = await supabaseAdmin.from('subscriptions').select('user_id, mp_subscription_id, status').eq('user_id', userId).maybeSingle(); // [cite: 259]
            if (data) subscriptionsToSync = [data]; // [cite: 260]
        } else {
            const { data } = await supabaseAdmin.from('subscriptions').select('user_id, mp_subscription_id, status').eq('status', 'pending').not('mp_subscription_id', 'is', null).limit(50); // [cite: 260, 261]
            subscriptionsToSync = data || [];
        }

        let synced = 0, skipped = 0, errors = 0; // [cite: 262, 263]

        for (const sub of subscriptionsToSync) {
            if (!sub.mp_subscription_id) { skipped++; continue; } // [cite: 263, 264]
            try {
                const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${sub.mp_subscription_id}`, { headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` } }); // [cite: 264]
                if (!mpRes.ok) { errors++; continue; } // [cite: 265, 266]

                const mpData = await mpRes.json();
                const mpStatus = normalizeSubscriptionStatus(mpData.status); // [cite: 267]

                if (mpStatus === sub.status) { skipped++; continue; } // [cite: 267, 268]
                if (mpStatus === 'authorized') { // [cite: 269]
                    await SubscriptionBillingEngine.handleAuthorized(sub.user_id, sub.mp_subscription_id, mpData); // [cite: 269]
                } else if (mpStatus === 'paused') { // [cite: 270]
                    await SubscriptionBillingEngine.handlePaused(sub.user_id, sub.mp_subscription_id, mpData); // [cite: 270]
                } else if (mpStatus === 'cancelled') { // [cite: 271]
                    await SubscriptionBillingEngine.handleCancelled(sub.user_id, sub.mp_subscription_id, mpData); // [cite: 271]
                } else if (mpStatus === 'expired') { // [cite: 272]
                    await SubscriptionBillingEngine.handleExpired(sub.user_id, sub.mp_subscription_id, mpData); // [cite: 272]
                } else {
                    await supabaseAdmin.from('subscriptions').update({ status: mpStatus, last_webhook_at: new Date().toISOString() }).eq('user_id', sub.user_id); // [cite: 273]
                }
                synced++; // [cite: 275]
            } catch (subErr) { errors++; } // [cite: 277, 278]
        }

        if (cronRunId) {
            await supabaseAdmin.from('cron_runs').update({ finished_at: new Date().toISOString(), status: errors > 0 ? 'partial' : 'success' }).eq('id', cronRunId).catch(() => { }); // [cite: 279]
        }
        return res.status(200).json({ success: true, total: subscriptionsToSync.length, synced, skipped, errors }); // [cite: 280]
    } catch (err) {
        return res.status(500).json({ error: 'Erro ao executar sincronização.', message: err.message }); // [cite: 283]
    }
}

// =========================================================
// HANDLER: handleAccessCheck
// =========================================================

async function handleAccessCheck(req, res) {
    res.status(200).json({ status: 'free', isPro: false }); // [cite: 284]
}

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
            await handleSubscriptionStatus(req, res); // [cite: 293]
        } else if (route === 'subscription/sync') {
            await handleSubscriptionSync(req, res); // [cite: 294]
        } else if (route === 'webhooks/mercadopago' || route === 'webhook/mercadopago') {
            await handleWebhookMercadoPago(req, res); // [cite: 295]
        } else if (route === 'access/check' || route === 'auth/check-access') {
            await handleAccessCheck(req, res); // [cite: 296]
        } else if (route === 'payments/create') {
            await handlePaymentsCreate(req, res, route); // [cite: 297]
        } else if (route === '' || route === 'health') {
            res.status(200).json({ status: 'online', ts: new Date().toISOString() }); // [cite: 298]
        } else {
            res.status(404).json({ error: `Rota não encontrada: ${route}` }); // [cite: 300]
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro interno.', message: error.message }); // [cite: 301]
    }
}