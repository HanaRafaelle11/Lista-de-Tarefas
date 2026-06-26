import crypto from 'crypto'; // [cite: 1]
// NOTA: MPPayment mantido para o fluxo LEGACY de pagamentos avulsos.
// O novo fluxo de assinaturas usa fetch direto à API REST do Mercado Pago. [cite: 2]
import { MercadoPagoConfig, Payment as MPPayment } from 'mercadopago'; // [cite: 3]

import { supabaseAdmin } from '../lib/supabase.js'; // [cite: 3]

// =========================================================
// UTILITÁRIOS DE SEGURANÇA E MASCARAMENTO
// =========================================================

const maskEmail = (email) => { // [cite: 4]
    if (!email) return '';
    const [user, domain] = email.split('@'); // [cite: 5]
    return `${user.substring(0, 3)}***@${domain}`;
};

const maskCpf = (cpf) => { // [cite: 5]
    if (!cpf) return '';
    return `***.${cpf.substring(3, 6)}.${cpf.substring(6, 9)}-**`; // [cite: 6]
};

const isGenericName = (name) => { // [cite: 6]
    const genericNames = ['teste', 'test', 'usuario', 'user', 'admin'];
    return genericNames.includes(name.toLowerCase().trim()); // [cite: 7]
};

// =========================================================
// normalizeStatus — MANTIDA (fluxo legado de pagamentos)
// =========================================================

const normalizeStatus = (status) => { // [cite: 7]
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
// Persiste o status exato retornado pelo Mercado Pago. [cite: 9]
// Não assume nenhum status como default de sandbox. [cite: 10]
// =========================================================

const subscriptionStatusMap = { // [cite: 10]
    'authorized': 'authorized',
    'paused': 'paused',
    'cancelled': 'cancelled',
    'expired': 'expired',
    'payment_required': 'payment_required',
    'pending': 'pending'
};
const normalizeSubscriptionStatus = (status) => { // [cite: 11]
    if (!status) return null;
    const normalized = subscriptionStatusMap[status];
    if (!normalized) { // [cite: 12]
        console.warn(`[normalizeSubscriptionStatus] Status desconhecido do MP: "${status}" — preservando como recebido.`);
        return status; // preserva status desconhecido em vez de assumir valor padrão [cite: 13]
    }
    return normalized; // [cite: 13]
}; // [cite: 14]

// =========================================================
// MÁQUINA DE ESTADOS — LEGACY PAYMENT FLOW
// =========================================================

// LEGACY PAYMENT FLOW
const PaymentStateMachine = { // [cite: 14]
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
// avulsos anteriores à migração para assinaturas. [cite: 17]
// NÃO usar para novos fluxos. Use SubscriptionBillingEngine. [cite: 18]
// =========================================================

// LEGACY PAYMENT FLOW
const BillingEngine = { // [cite: 18]
    async handlePaymentApproved(userId, customerId, paymentIdStr, paymentResult) {
        if (!userId) return;
        const now = new Date(); // [cite: 19]
        const d = new Date();
        d.setDate(d.getDate() + 30);
        const expiresAt = d.toISOString();
        // LEGACY PAYMENT FLOW — billing_events insert [cite: 20]
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
        // LEGACY PAYMENT FLOW — profiles update [cite: 22]
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
    } // [cite: 25]
};

// =========================================================
// SubscriptionBillingEngine — NOVO
// Gerencia todo o ciclo de vida de assinaturas recorrentes
// via Mercado Pago Preapproval API. [cite: 25]
// =========================================================

const SubscriptionBillingEngine = { // [cite: 25]

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
            console.error(`[SubscriptionBillingEngine.logEvent] Falha ao registrar evento "${eventType}":`, logErr.message);
        } // [cite: 29]
    },

    // Ativa premium: status authorized
    async handleAuthorized(userId, mpSubscriptionId, subscriptionResult) {
        if (!userId || !mpSubscriptionId) return;
        const now = new Date().toISOString(); // [cite: 30]

        const nextBillingDate = subscriptionResult.next_payment_date || null;
        // DENORMALIZAÇÃO — fonte de verdade é subscriptions.status [cite: 31]
        // profiles.assinatura_status existe apenas para leitura rápida no frontend
        await supabaseAdmin.from('profiles').update({
            plano: 'premium',
            assinatura_status: 'authorized',
            assinatura_inicio: now,
            assinatura_expira_em: nextBillingDate,
            mercadopago_customer_id: subscriptionResult.payer_id // [cite: 31]
                ? String(subscriptionResult.payer_id)
                : null,
            updated_at: now
        }).eq('id', userId); // [cite: 32]
        await supabaseAdmin.from('subscriptions').upsert({ // [cite: 33]
            user_id: userId,
            mp_subscription_id: mpSubscriptionId,
            status: 'authorized',
            plan: 'premium',
            amount: 14.90,
            next_billing_date: nextBillingDate,
            payer_id: subscriptionResult.payer_id // [cite: 33]
                ? String(subscriptionResult.payer_id)
                : null,
            provider: 'mercado_pago',
            updated_at: now
        }, { onConflict: 'user_id' }); // [cite: 34]
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
        }).eq('id', userId); // [cite: 38]
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
        }, { onConflict: 'user_id' }); // [cite: 40]
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
        }).eq('id', userId); // [cite: 43]
        await supabaseAdmin.from('subscriptions').upsert({ // [cite: 44]
            user_id: userId,
            mp_subscription_id: mpSubscriptionId,
            status: 'paused',
            updated_at: now
        }, { onConflict: 'user_id' }); // [cite: 44]
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
        }).eq('id', userId); // [cite: 47]
        await supabaseAdmin.from('subscriptions').upsert({ // [cite: 48]
            user_id: userId,
            mp_subscription_id: mpSubscriptionId,
            status: 'cancelled',
            updated_at: now
        }, { onConflict: 'user_id' }); // [cite: 48]
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
        }).eq('id', userId); // [cite: 51]
        await supabaseAdmin.from('subscriptions').upsert({ // [cite: 52]
            user_id: userId,
            mp_subscription_id: mpSubscriptionId,
            status: 'expired',
            updated_at: now
        }, { onConflict: 'user_id' }); // [cite: 52]
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
        }).eq('id', userId); // [cite: 55]
        await supabaseAdmin.from('subscriptions').upsert({ // [cite: 56]
            user_id: userId,
            mp_subscription_id: mpSubscriptionId,
            status: 'paused',
            updated_at: now
        }, { onConflict: 'user_id' }); // [cite: 56]
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

const BillingTracer = { // [cite: 58]
    runWithTrace: async (id, fn) => await fn(),
    recordTrace: async () => { }
};

// =========================================================
// MIDDLEWARE: checkPremiumAccess
// Consulta a tabela subscriptions e verifica se o usuário
// tem status "authorized". 
// Todos os demais status bloqueiam. [cite: 60]
// =========================================================

async function checkPremiumAccess(userId) { // [cite: 60]
    if (!userId) return { allowed: false, reason: 'userId ausente' };
    try { // [cite: 61]
        const { data: subscription, error } = await supabaseAdmin
            .from('subscriptions')
            .select('status, mp_subscription_id, next_billing_date')
            .eq('user_id', userId)
            .maybeSingle();
        if (error) { // [cite: 62]
            console.error('[checkPremiumAccess] Erro ao consultar subscriptions:', error.message);
            return { allowed: false, reason: 'erro_db' }; // [cite: 63]
        }

        if (!subscription) {
            return { allowed: false, reason: 'sem_assinatura' };
        } // [cite: 64]

        const allowedStatuses = ['authorized'];
        const blockedStatuses = ['paused', 'cancelled', 'expired', 'pending', 'payment_required'];
        if (allowedStatuses.includes(subscription.status)) { // [cite: 65]
            return {
                allowed: true,
                status: subscription.status,
                mp_subscription_id: subscription.mp_subscription_id,
                next_billing_date: subscription.next_billing_date
            };
        } // [cite: 66]

        if (blockedStatuses.includes(subscription.status)) {
            return {
                allowed: false,
                reason: `status_bloqueado:${subscription.status}`,
                status: subscription.status
            };
        } // [cite: 67]

        // Status desconhecido — nega acesso por segurança
        return { allowed: false, reason: `status_desconhecido:${subscription.status}` };
    } catch (err) { // [cite: 68]
        console.error('[checkPremiumAccess] Exceção:', err.message);
        return { allowed: false, reason: 'excecao_interna' }; // [cite: 69]
    }
}

// =========================================================
// HANDLER: handleSubscriptionCreate (NOVO)
// POST /api/subscription/create
// Chama POST https://api.mercadopago.com/preapproval [cite: 69]
// =========================================================

async function handleSubscriptionCreate(req, res) { // [cite: 69]
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
    } // [cite: 70]

    try {
        const {
            card_token_id,
            email,
            cpf,
            userId,
            firstName,
            lastName
        } = req.body || {}; // [cite: 71]

        // Validações de entrada
        if (!userId) {
            return res.status(400).json({ error: 'userId é obrigatório.' });
        } // [cite: 72]
        if (!card_token_id) {
            return res.status(400).json({ error: 'card_token_id é obrigatório.' });
        } // [cite: 73]
        if (!email) {
            return res.status(400).json({ error: 'email é obrigatório.' });
        } // [cite: 74]
        if (!cpf) {
            return res.status(400).json({ error: 'cpf é obrigatório.' });
        } // [cite: 75]

        const cleanCpf = cpf.replace(/\D/g, '');
        if (cleanCpf.length !== 11) { // [cite: 76]
            return res.status(400).json({ error: 'CPF inválido. Deve conter 11 dígitos.' });
        } // [cite: 77]

        // Resolução do nome: payload > perfil Supabase
        let first_name = firstName?.trim() || ''; // [cite: 78]
        let last_name = lastName?.trim() || '';

        if (!first_name || !last_name) {
            try {
                const { data: profile } = await supabaseAdmin
                    .from('profiles')
                    .select('name, nickname')
                    .eq('id', userId) // [cite: 79]
                    .maybeSingle(); // [cite: 80]
                const fullName = profile?.name || profile?.nickname || '';
                if (fullName) {
                    const parts = fullName.trim().split(/\s+/);
                    if (!first_name) first_name = parts[0] || ''; // [cite: 81]
                    if (!last_name) last_name = parts.slice(1).join(' ') || '';
                } // [cite: 82]
            } catch (profileErr) {
                console.warn('[handleSubscriptionCreate] Falha ao buscar perfil:', profileErr.message);
            } // [cite: 83]
        }

        if (!first_name || !last_name || isGenericName(first_name) || isGenericName(last_name)) {
            return res.status(400).json({ error: 'Nome e sobrenome válidos são obrigatórios.' });
        } // [cite: 84]

        // Idempotência: verifica se já existe assinatura authorized para este userId
        const { data: existingSub } = await supabaseAdmin
            .from('subscriptions')
            .select('mp_subscription_id, status, next_billing_date')
            .eq('user_id', userId)
            .maybeSingle(); // [cite: 85]
        if (existingSub && existingSub.status === 'authorized' && existingSub.mp_subscription_id) {
            console.log(`[handleSubscriptionCreate] Assinatura já ativa para userId=${userId}`);
            return res.status(200).json({ // [cite: 86]
                success: true,
                alreadyExists: true,
                mp_subscription_id: existingSub.mp_subscription_id,
                status: 'authorized',
                next_payment_date: existingSub.next_billing_date
            });
        } // [cite: 87]

        // Payload da Preapproval API do Mercado Pago
        const preapprovalPayload = {
            reason: 'MyFlowDay Premium',
            payer_email: email.trim(),
            card_token_id: card_token_id,
            status: 'authorized',
            auto_recurring: {
                frequency: 1, // [cite: 88]
                frequency_type: 'months',
                transaction_amount: 14.90,
                currency_id: 'BRL'
            },
            // Identificação do pagador
            payer: { // [cite: 89]
                email: email.trim(),
                identification: {
                    type: 'CPF',
                    number: cleanCpf
                }
            }, // [cite: 90]
            // external_reference para rastrear no webhook
            external_reference: `mfd_premium_${userId}`,
            // URL de retorno do webhook
            notification_url: process.env.MP_WEBHOOK_URL || 'https://myflowday.com.br/api/webhooks/mercadopago' // [cite: 91]
        };

        console.log('[handleSubscriptionCreate] Enviando para /preapproval:', {
            payer_email: maskEmail(email),
            has_token: !!card_token_id,
            cpf: maskCpf(cleanCpf),
            userId: userId
        }); // [cite: 92]
        // Idempotency key estável por userId — impede criação duplicada em double-click ou retry.
        // Usar userId como chave garante que a mesma requisição do mesmo usuário seja [cite: 93]
        // deduplicada pelo Mercado Pago durante a janela de idempotência (tipicamente 24h).
        const idempotencyKey = `subscription_create_${userId}`; // [cite: 94]

        // ── [MP DEBUG] Diagnóstico temporário — remover após identificar causa do erro 404 ──
        console.log('[MP DEBUG] MP_ACCESS_TOKEN existe?', !!process.env.MP_ACCESS_TOKEN);
        console.log('[MP DEBUG] Prefixo token:', process.env.MP_ACCESS_TOKEN?.substring(0, 10)); // [cite: 95]
        console.log('[MP DEBUG] card_token_id:', card_token_id);
        console.log('[MP DEBUG] email:', email);
        console.log('[MP DEBUG] cpf:', cleanCpf);
        console.log('[MP DEBUG] first_name:', first_name); // [cite: 96]
        console.log('[MP DEBUG] last_name:', last_name);
        console.log('[MP DEBUG] preapprovalPayload:', JSON.stringify(preapprovalPayload, null, 2));
        // ── fim [MP DEBUG] ─────────────────────────────────────────────────────────────── [cite: 97]

        // Chama a API REST do Mercado Pago diretamente
        const mpResponse = await fetch('https://api.mercadopago.com/preapproval', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': idempotencyKey // [cite: 98]
            },
            body: JSON.stringify(preapprovalPayload)
        }); // [cite: 99]
        const mpData = await mpResponse.json();

        // ── [MP DEBUG] Diagnóstico temporário — remover após identificar causa do erro 404 ──
        console.log('[MP DEBUG] HTTP Status:', mpResponse.status);
        console.log('[MP DEBUG] MP Response:', JSON.stringify(mpData, null, 2)); // [cite: 100]
        // ── fim [MP DEBUG] ───────────────────────────────────────────────────────────────

        if (!mpResponse.ok) {
            console.error('[handleSubscriptionCreate] Erro MP:', JSON.stringify(mpData));
            // Log do erro na subscription_logs mesmo em falha [cite: 101]
            await SubscriptionBillingEngine.logEvent(null, 'subscription.create_failed', {
                user_id: userId,
                mp_error: mpData,
                status_code: mpResponse.status
            });
            return res.status(400).json({ // [cite: 102]
                error: mpData.message || 'Falha ao criar assinatura no Mercado Pago.',
                mp_status: mpResponse.status,
                details: mpData
            });
        } // [cite: 103]

        const mpSubscriptionId = mpData.id;
        const subscriptionStatus = normalizeSubscriptionStatus(mpData.status);
        const nextPaymentDate = mpData.next_payment_date || null; // [cite: 104]
        const payerId = mpData.payer_id ? String(mpData.payer_id) : null;
        const now = new Date().toISOString();
        console.log(`[handleSubscriptionCreate] MP retornou: id=${mpSubscriptionId} status=${subscriptionStatus}`); // [cite: 105]

        // SOURCE OF TRUTH: salva sempre 'pending' no Supabase ao criar.
        // O webhook é o único responsável por mover para 'authorized'. [cite: 106]
        // Estratégia híbrida: o status real do MP é retornado ao frontend [cite: 107]
        // (que pode mostrar 'Ativada!' se MP retornar authorized imediatamente),
        // mas o banco fica 'pending' até o webhook confirmar.
        const { error: upsertError } = await supabaseAdmin.from('subscriptions').upsert({ // [cite: 108]
            user_id: userId,
            mp_subscription_id: mpSubscriptionId,
            status: 'pending',              // sempre pending — webhook updates
            plan: 'premium',
            amount: 14.90,
            next_billing_date: nextPaymentDate, // [cite: 109]
            payer_id: payerId,
            provider: 'mercado_pago',
            webhook_payload: mpData,
            updated_at: now
        }, { onConflict: 'user_id' });
        if (upsertError) { // [cite: 110]
            console.error('[handleSubscriptionCreate] Erro ao salvar no Supabase:', upsertError.message);
            // Não bloqueia o retorno — assinatura foi criada no MP [cite: 111]
        }

        // Loga a criação independente do status
        // NÃO aciona handleAuthorized aqui — apenas o webhook deve fazer isso
        await SubscriptionBillingEngine.logEvent(mpSubscriptionId, `subscription.created.${subscriptionStatus}`, {
            user_id: userId,
            mp_status: mpData.status,
            next_payment_date: nextPaymentDate // [cite: 112]
        });
        return res.status(200).json({ // [cite: 113]
            success: true,
            mp_subscription_id: mpSubscriptionId,
            status: subscriptionStatus,   // status real do MP para o frontend
            next_payment_date: nextPaymentDate,
            date_created: mpData.date_created || now
        });
    } catch (error) { // [cite: 114]
        console.error('[handleSubscriptionCreate] Erro crítico:', error);
        return res.status(500).json({ // [cite: 115]
            error: 'Erro interno ao criar assinatura.',
            message: error.message
        });
    } // [cite: 116]
}

// =========================================================
// HANDLER: handleSubscriptionStatus (NOVO)
// GET /api/subscription/status?userId=...
// Consulta status atual da assinatura do usuário
// =========================================================

async function handleSubscriptionStatus(req, res) { // [cite: 116]
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método não permitido. Utilize GET.' });
    } // [cite: 117]

    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).json({ error: 'userId é obrigatório.' });
    } // [cite: 118]

    try {
        const access = await checkPremiumAccess(userId);
        if (access.allowed) { // [cite: 119]
            return res.status(200).json({
                isPremium: true,
                status: access.status,
                mp_subscription_id: access.mp_subscription_id,
                next_billing_date: access.next_billing_date
            });
        } // [cite: 120]

        return res.status(200).json({
            isPremium: false,
            status: access.status || null,
            reason: access.reason
        });
    } catch (err) { // [cite: 121]
        console.error('[handleSubscriptionStatus] Erro:', err.message);
        return res.status(500).json({ error: 'Erro ao verificar status da assinatura.' }); // [cite: 122]
    } // [cite: 123]
}

// =========================================================
// VALIDAÇÃO DE ASSINATURA DO WEBHOOK (MP_VALIDATE_SIGNATURE)
// Suporte a x-signature e x-request-id do Mercado Pago. [cite: 124]
// Ativação: configure MP_VALIDATE_SIGNATURE=true no Vercel
// e MP_WEBHOOK_SECRET com o secret gerado no painel do MP. [cite: 125]
// Por padrão desativado (MP_VALIDATE_SIGNATURE=false) para
// facilitar a homologação sem configuração adicional. [cite: 126]
// =========================================================

function validateMercadoPagoWebhook(req) { // [cite: 126]
    const signatureEnabled = process.env.MP_VALIDATE_SIGNATURE === 'true';
    if (!signatureEnabled) { // [cite: 127]
        // Validação desativada — aceitar todos os webhooks
        return { valid: true, skipped: true };
    } // [cite: 128]

    try {
        const xSignature = req.headers['x-signature'] || '';
        const xRequestId = req.headers['x-request-id'] || ''; // [cite: 129]
        const webhookSecret = process.env.MP_WEBHOOK_SECRET || '';
        if (!webhookSecret) { // [cite: 130]
            console.warn('[validateMercadoPagoWebhook] MP_WEBHOOK_SECRET não configurado. Ignorando validação.');
            return { valid: true, skipped: true, reason: 'secret_not_configured' }; // [cite: 131]
        }

        if (!xSignature) {
            console.warn('[validateMercadoPagoWebhook] Header x-signature ausente.');
            return { valid: false, reason: 'missing_x_signature' }; // [cite: 132]
        }

        // Extrai ts e v1 do header x-signature
        // Formato: ts=<timestamp>,v1=<hash>
        const parts = {};
        xSignature.split(',').forEach(part => { // [cite: 133]
            const [key, value] = part.split('=');
            if (key && value) parts[key.trim()] = value.trim();
        }); // [cite: 134]
        const { ts, v1 } = parts;
        if (!ts || !v1) {
            return { valid: false, reason: 'invalid_x_signature_format' };
        } // [cite: 135]

        // Monta a string de assinatura conforme documentação MP
        // Formato: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
        const dataId = req.body?.data?.id || req.body?.id || ''; // [cite: 136]
        const signatureString = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
        // HMAC-SHA256 [cite: 137]
        const expectedHash = crypto
            .createHmac('sha256', webhookSecret)
            .update(signatureString)
            .digest('hex');
        if (expectedHash !== v1) { // [cite: 138]
            console.error('[validateMercadoPagoWebhook] Assinatura inválida!');
            return { valid: false, reason: 'signature_mismatch' }; // [cite: 139]
        }

        return { valid: true, skipped: false };
    } catch (err) { // [cite: 140]
        console.error('[validateMercadoPagoWebhook] Exceção:', err.message);
        return { valid: false, reason: 'exception', error: err.message }; // [cite: 141]
    }
}

// =========================================================
// HANDLER: handleWebhookMercadoPago (ADAPTADO)
// POST /api/webhooks/mercadopago
// Processa eventos preapproval e payment (recorrente)
// Registra TODOS os eventos em subscription_logs,
// mesmo os desconhecidos. 
// =========================================================

async function handleWebhookMercadoPago(req, res) {
    // 6. Adicionar proteção global: try/catch no handler inteiro
    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Método não permitido. Utilize POST.' }); // [cite: 143]
        }

        const requestTraceId = req.headers['x-trace-id'] || crypto.randomUUID();
        const body = req.body || {}; // [cite: 144]
        console.log(`[Webhook] Recebido: type=${body.type} | topic=${body.topic} | traceId=${requestTraceId}`);

        // ── Validação de assinatura do webhook ──
        const signatureCheck = validateMercadoPagoWebhook(req); // [cite: 145]
        if (!signatureCheck.valid) {
            console.error(`[Webhook] Assinatura inválida: ${signatureCheck.reason}`);
            await SubscriptionBillingEngine.logEvent(null, 'webhook.signature_rejected', { // [cite: 146]
                reason: signatureCheck.reason,
                type: body.type
            });
            return res.status(401).json({ error: 'Assinatura do webhook inválida.' }); // [cite: 147]
        }

        // 1 e 3. Localizar ocorrências e definir de forma segura a partir do payload do MP (Escopo Global)
        const preapprovalIdStr =
            body?.data?.id ||
            body?.data?.preapproval_id ||
            body?.id;

        // 4. Se não existir valor, o webhook NÃO deve quebrar: apenas logar e dar return seguro
        if (!preapprovalIdStr) {
            console.log('[Webhook] preapprovalIdStr ausente, ignorando evento');
            return res.status(200).json({ message: 'Evento ignorado por falta de ID válido.' });
        }

        // ── IDEMPOTÊNCIA ──
        const eventId = body.id // [cite: 150]
            ? String(body.id)
            : `${body.type || body.topic || 'unknown'}_${preapprovalIdStr}_${body.action || 'event'}`;

        try { // [cite: 151]
            const { data: alreadyProcessed } = await supabaseAdmin
                .from('webhook_events')
                .select('id, processed_at')
                .eq('event_id', eventId)
                .maybeSingle();
            if (alreadyProcessed) { // [cite: 152]
                console.log(`[Webhook] Evento já processado (idempotência): eventId=${eventId} | processedAt=${alreadyProcessed.processed_at}`);
                return res.status(200).json({ message: 'Evento já processado.', idempotent: true });
            }
        } catch (idempotencyErr) { // [cite: 153]
            console.warn('[Webhook] Aviso de idempotência (execute migration v21):', idempotencyErr.message);
        }

        return await BillingTracer.runWithTrace(requestTraceId, async () => { // [cite: 154]
            // ── Evento de ASSINATURA (preapproval) ──────────────────────────
            if (body.type === 'preapproval' || body.topic === 'preapproval') { // [cite: 155]

                // Busca detalhes da assinatura na API do MP
                const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalIdStr}`, { // [cite: 156]
                    headers: {
                        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`
                    }
                }); // [cite: 157]

                if (!mpRes.ok) {
                    console.error(`[Webhook] Falha ao buscar preapproval/${preapprovalIdStr}`);
                    await SubscriptionBillingEngine.logEvent(preapprovalIdStr, 'webhook.preapproval.fetch_failed', { // [cite: 158]
                        http_status: mpRes.status
                    });
                    return res.status(200).json({ message: 'Falha ao buscar preapproval no MP.' }); // [cite: 159]
                }

                const preapprovalData = await mpRes.json(); // [cite: 161]
                const subscriptionStatus = normalizeSubscriptionStatus(preapprovalData.status);
                const externalRef = preapprovalData.external_reference || '';

                let userId = null;
                if (externalRef.startsWith('mfd_premium_')) { // [cite: 163]
                    userId = externalRef.replace('mfd_premium_', '');
                } else { // [cite: 164]
                    const { data: subRow } = await supabaseAdmin
                        .from('subscriptions')
                        .select('user_id')
                        .eq('mp_subscription_id', preapprovalIdStr) // [cite: 165]
                        .maybeSingle(); // [cite: 166]
                    userId = subRow?.user_id || null;
                }

                const now = new Date().toISOString();
                await supabaseAdmin.from('subscriptions').upsert({ // [cite: 167]
                    user_id: userId,
                    mp_subscription_id: preapprovalIdStr,
                    status: subscriptionStatus,
                    last_webhook_at: now,
                    webhook_payload: preapprovalData, // [cite: 168]
                    updated_at: now
                }, { onConflict: 'mp_subscription_id' });

                if (subscriptionStatus === 'authorized') { // [cite: 169]
                    await SubscriptionBillingEngine.handleAuthorized(userId, preapprovalIdStr, preapprovalData);
                } else if (subscriptionStatus === 'paused') { // [cite: 170]
                    await SubscriptionBillingEngine.handlePaused(userId, preapprovalIdStr, preapprovalData);
                } else if (subscriptionStatus === 'cancelled') { // [cite: 171]
                    await SubscriptionBillingEngine.handleCancelled(userId, preapprovalIdStr, preapprovalData);
                } else if (subscriptionStatus === 'expired') { // [cite: 172]
                    await SubscriptionBillingEngine.handleExpired(userId, preapprovalIdStr, preapprovalData);
                } else { // [cite: 173]
                    await SubscriptionBillingEngine.logEvent(preapprovalIdStr, `preapproval.${subscriptionStatus || 'unknown'}`, {
                        user_id: userId,
                        mp_status: preapprovalData.status, // [cite: 174]
                        raw: preapprovalData
                    });
                    console.warn(`[Webhook] Status de preapproval não mapeado: ${preapprovalData.status}`); // [cite: 175]
                }

                // Salva evento na webhook_events após processar preapproval com sucesso
                await supabaseAdmin.from('webhook_events').insert([{ // [cite: 178]
                    event_id: eventId,
                    event_type: body.type || 'preapproval',
                    resource_id: preapprovalIdStr,
                    payload: body
                }]).catch((e) => console.warn('[Webhook] Não foi possível salvar webhook_events:', e.message));

                return res.status(200).json({ // [cite: 176]
                    success: true,
                    event: 'preapproval',
                    preapprovalId: preapprovalIdStr,
                    status: subscriptionStatus
                });
            }

            // 5. Garantir suporte correto para: type: "payment", action: "payment.updated" e outros eventos
            if (body.type === 'payment' || body.topic === 'payment' || body.action === 'payment.updated') { // [cite: 179]

                // Busca detalhes do pagamento na API do MP
                const mpPayRes = await fetch(`https://api.mercadopago.com/v1/payments/${preapprovalIdStr}`, { // [cite: 182]
                    headers: {
                        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`
                    }
                });

                if (!mpPayRes.ok) { // [cite: 184]
                    await SubscriptionBillingEngine.logEvent(null, 'webhook.payment.fetch_failed', {
                        payment_id: preapprovalIdStr,
                        http_status: mpPayRes.status
                    });
                    return res.status(200).json({ message: 'Falha ao buscar payment no MP.' }); // [cite: 185]
                }

                const paymentData = await mpPayRes.json(); // [cite: 186]
                const paymentStatus = normalizeStatus(paymentData.status); // [cite: 187]

                let userId = paymentData.metadata?.user_id || null;
                const externalRef = paymentData.external_reference || ''; // [cite: 188]

                if (!userId && externalRef.startsWith('mfd_premium_')) {
                    userId = externalRef.replace('mfd_premium_', ''); // [cite: 189]
                }

                const mpSubscriptionId = paymentData.preapproval_id // [cite: 190]
                    ? String(paymentData.preapproval_id)
                    : null;

                if (!userId && mpSubscriptionId) { // [cite: 191]
                    const { data: subRow } = await supabaseAdmin
                        .from('subscriptions')
                        .select('user_id')
                        .eq('mp_subscription_id', mpSubscriptionId) // [cite: 192]
                        .maybeSingle(); // [cite: 193]
                    userId = subRow?.user_id || null;
                }

                await SubscriptionBillingEngine.logEvent( // [cite: 194]
                    mpSubscriptionId,
                    `payment.${paymentData.status || 'unknown'}`,
                    {
                        payment_id: preapprovalIdStr,
                        user_id: userId,
                        status: paymentData.status,
                        status_detail: paymentData.status_detail, // [cite: 195]
                        transaction_amount: paymentData.transaction_amount,
                        date_approved: paymentData.date_approved,
                        preapproval_id: mpSubscriptionId
                    }
                );

                if (mpSubscriptionId) { // [cite: 197]
                    await supabaseAdmin.from('subscriptions')
                        .update({
                            last_webhook_at: new Date().toISOString(),
                            last_payment_date: paymentData.date_approved || new Date().toISOString() // [cite: 198]
                        })
                        .eq('mp_subscription_id', mpSubscriptionId);
                }

                if (paymentStatus === 'approved' && userId) { // [cite: 199]
                    await SubscriptionBillingEngine.handlePaymentApproved(
                        userId,
                        mpSubscriptionId, // [cite: 200]
                        preapprovalIdStr,
                        paymentData.transaction_amount
                    );
                } else if (paymentStatus === 'refunded' && userId) { // [cite: 201]
                    await SubscriptionBillingEngine.handleChargedBack(userId, mpSubscriptionId, preapprovalIdStr, paymentData);
                } else { // [cite: 202]
                    console.warn(`[Webhook] Payment ${preapprovalIdStr} com status="${paymentData.status}" — sem ação automática.`);
                }

                // Salva evento na webhook_events após processar payment com sucesso
                await supabaseAdmin.from('webhook_events').insert([{ // [cite: 206]
                    event_id: eventId,
                    event_type: body.type || 'payment',
                    resource_id: preapprovalIdStr,
                    payload: body
                }]).catch((e) => console.warn('[Webhook] Não foi possível salvar webhook_events:', e.message));

                return res.status(200).json({ // [cite: 204]
                    success: true,
                    event: 'payment',
                    paymentId: preapprovalIdStr,
                    status: paymentData.status
                });
            }

            // ── Evento desconhecido — loga e responde 200 ───────────────────
            await SubscriptionBillingEngine.logEvent(null, `webhook.unknown.${body.type || 'no_type'}`, { body }); // [cite: 207]
            console.warn(`[Webhook] Evento não reconhecido: type=${body.type} topic=${body.topic}`); // [cite: 208]

            await supabaseAdmin.from('webhook_events').insert([{ // [cite: 209]
                event_id: eventId,
                event_type: body.type || body.topic || 'unknown',
                resource_id: preapprovalIdStr,
                payload: body
            }]).catch(() => { });

            return res.status(200).json({ message: 'Evento recebido e logado, mas não processado.' }); // [cite: 210]
        });

    } catch (webhookErr) { // [cite: 211]
        // 6. Qualquer erro deve retornar status 200 com log interno (evita retries infinitos)
        console.error('[Webhook Critical Error] Erro capturado no wrapper global:', webhookErr);

        try { // [cite: 212]
            await SubscriptionBillingEngine.logEvent(null, 'webhook.critical_error', {
                error: webhookErr.message,
                body: req.body
            });
        } catch (_) { /* silencia falha no log de fallback */ }

        return res.status(200).json({
            error: true,
            message: 'Erro interno silenciado para evitar retries do Mercado Pago.'
        }); // [cite: 213]
    }
}

// =========================================================
// HANDLER: handlePaymentsCreate — LEGACY PAYMENT FLOW
// Mantido para compatibilidade com fluxos anteriores. [cite: 215]
// NÃO usar para novos cadastros. Use handleSubscriptionCreate.
// =========================================================

// LEGACY PAYMENT FLOW
async function handlePaymentsCreate(req, res, routePath) { // [cite: 215]
    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
        } // [cite: 216]

        // LEGACY PAYMENT FLOW
        const { userId, email: emailRoot, amount, payment_method_id, token, installments, cpf: cpfRoot, deviceId, external_reference, metadata, payer } = req.body || {}; // [cite: 217]
        const idempotencyKey = req.headers['x-idempotency-key'] || crypto.randomUUID();

        const email = emailRoot || payer?.email || '';
        const cpf = cpfRoot || payer?.identification?.number || ''; // [cite: 218]
        const payerFirstName = payer?.first_name || '';
        const payerLastName = payer?.last_name || ''; // [cite: 219]
        if (!userId || !email || !payment_method_id) {
            return res.status(400).json({ error: 'Campos obrigatórios em falta: userId, email ou payment_method_id.' });
        } // [cite: 220]

        const cleanCpf = cpf ? cpf.replace(/\D/g, '') : '';
        let first_name = payerFirstName; // [cite: 221]
        let last_name = payerLastName;

        if (!first_name || !last_name) {
            try {
                const { data: profile } = await supabaseAdmin
                    .from('profiles')
                    .select('name, nickname')
                    .eq('id', userId) // [cite: 222]
                    .maybeSingle(); // [cite: 223]
                const fullName = profile?.name || profile?.nickname;
                if (fullName) {
                    const parts = fullName.trim().split(/\s+/);
                    first_name = first_name || parts[0] || ''; // [cite: 224]
                    last_name = last_name || parts.slice(1).join(' ') || '';
                } // [cite: 225]
            } catch (err) {
                console.warn(`[LEGACY] Falha ao procurar perfil:`, err.message);
            } // [cite: 226]
        }

        if (!first_name || !last_name || isGenericName(first_name) || isGenericName(last_name)) {
            return res.status(400).json({ error: 'Nome e sobrenome válidos são obrigatórios para prosseguir.' });
        } // [cite: 227]

        const finalAmount = Number(amount) || 14.90;
        const uniqueTimestamp = new Date().getTime();
        const payerForPix = { // [cite: 228]
            email: email.trim(),
            entity_type: 'individual',
            identification: { type: 'CPF', number: cleanCpf }
        };
        const payerForCard = { // [cite: 229]
            email: email.trim(),
            entity_type: 'individual',
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            identification: { type: 'CPF', number: cleanCpf }
        };
        const payload = { // [cite: 230]
            transaction_amount: finalAmount,
            payment_method_id: payment_method_id,
            description: 'Plano MyFlowDay Premium',
            external_reference: external_reference || `order_${userId}_${uniqueTimestamp}`, // [cite: 231]
            statement_descriptor: 'MYFLOWDAY',
            payer: payment_method_id === 'pix' ? payerForPix : payerForCard, // [cite: 232]
            additional_info: {
                items: [{
                    id: 'premium-monthly',
                    title: 'Assinatura MyFlowDay Premium',
                    description: 'Acesso completo às ferramentas do MyFlowDay', // [cite: 233]
                    category_id: 'services',
                    quantity: 1,
                    unit_price: finalAmount
                }],
                payer: { first_name: first_name.trim(), last_name: last_name.trim() } // [cite: 234]
            },
            metadata: metadata || { user_id: userId, plan: 'premium' }, // [cite: 235]
            notification_url: process.env.MP_WEBHOOK_URL || 'https://myflowday.com.br/api/webhook/mercadopago' // [cite: 236]
        };

        if (payment_method_id !== 'pix') {
            payload.token = token;
            const resolvedInstallments = Number(installments) || 1; // [cite: 237]
            if (!Number.isInteger(resolvedInstallments) || resolvedInstallments < 1 || resolvedInstallments > 12) {
                return res.status(400).json({ error: 'Invalid installments value' });
            } // [cite: 238]
            payload.installments = resolvedInstallments;
        } // [cite: 239]

        // LEGACY PAYMENT FLOW — usa MP_ACCESS_TOKEN (mesma convenção do novo fluxo)
        const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
        const mpPayment = new MPPayment(mpClient); // [cite: 240]

        console.log('[LEGACY MP Request]:', {
            payment_method: payment_method_id,
            amount: finalAmount,
            has_device_fingerprint: !!deviceId,
            payer_email_masked: email ? email.slice(0, 3) + '***' : 'VAZIO'
        });
        let paymentResult; // [cite: 241]
        try {
            paymentResult = await mpPayment.create({
                body: payload,
                requestOptions: {
                    idempotencyKey,
                    ...(deviceId && { customHeaders: { 'X-Meli-Session-Id': deviceId } }) // [cite: 242]
                }
            });
        } catch (mpError) { // [cite: 243]
            const errData = mpError?.cause || mpError; // [cite: 244]
            console.error('[LEGACY Mercado Pago SDK Error]:', JSON.stringify(errData));
            return res.status(400).json({
                error: errData?.message || 'Falha no processamento no Mercado Pago.',
                status_detail: errData?.status_detail || null,
                details: errData
            });
        } // [cite: 245]

        const maskedResponse = {
            ...paymentResult,
            payer: paymentResult.payer ? { // [cite: 246]
                ...paymentResult.payer,
                email: maskEmail(paymentResult.payer.email),
                identification: paymentResult.payer.identification ? { // [cite: 247]
                    ...paymentResult.payer.identification,
                    number: maskCpf(paymentResult.payer.identification.number)
                } : undefined
            } : undefined
        };
        const paymentIdStr = String(paymentResult.id); // [cite: 248]
        const paymentStatusRaw = paymentResult.status;
        let paymentStatusNormalized = normalizeStatus(paymentStatusRaw);

        let isForcedPending = false;
        if (payment_method_id === 'pix' && paymentStatusNormalized === 'approved') { // [cite: 249]
            paymentStatusNormalized = 'pending';
            isForcedPending = true; // [cite: 250]
        }

        const { data: existingPayment } = await supabaseAdmin
            .from('payment_events')
            .select('status')
            .eq('payment_id', paymentIdStr)
            .maybeSingle();
        if (existingPayment && ['approved', 'rejected', 'cancelled', 'refunded', 'charged_back'].includes(existingPayment.status)) { // [cite: 251]
            return res.status(200).json({ success: true, alreadyProcessed: true, status: existingPayment.status });
        } // [cite: 252]

        await supabaseAdmin.from('payment_ledger').insert([{
            payment_id: paymentIdStr,
            event_type: 'payment_created',
            status_raw: 'created',
            status_normalized: 'created',
            user_id: userId,
            payload: maskedResponse
        }]);
        await supabaseAdmin.from('payment_events').upsert({ // [cite: 253]
            payment_id: paymentIdStr,
            status: 'created',
            user_id: userId,
            plan: 'premium',
            processed_at: new Date().toISOString(),
            raw_payload: maskedResponse
        }, { onConflict: 'payment_id' });
        await supabaseAdmin.from('subscriptions').upsert({ // [cite: 254]
            user_id: userId,
            status: 'past_due',
            plan: 'premium',
            last_payment_id: paymentIdStr,
            provider: 'mercado_pago',
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
        let currentStatus = 'created'; // [cite: 255]

        if (paymentStatusNormalized !== 'created') {
            try {
                PaymentStateMachine.transition(currentStatus, paymentStatusNormalized);
                await supabaseAdmin.from('payment_events') // [cite: 256]
                    .update({ status: paymentStatusNormalized, processed_at: new Date().toISOString(), raw_payload: maskedResponse })
                    .eq('payment_id', paymentIdStr);
                currentStatus = paymentStatusNormalized; // [cite: 257]

                if (paymentStatusNormalized === 'approved' && !isForcedPending) {
                    const customerId = paymentResult.payer?.id || null; // [cite: 258]
                    await BillingEngine.handlePaymentApproved(userId, customerId, paymentIdStr, paymentResult);
                }
            } catch (transitionErr) {
                console.error(`[LEGACY] Transição de estado inválida: ${transitionErr.message}`);
            } // [cite: 259]
        }

        const transactionData = paymentResult.point_of_interaction?.transaction_data || {}; // [cite: 260]

        if (payment_method_id === 'pix') {
            const statusDetail = paymentResult.status_detail || 'sem_detalhe'; // [cite: 261]
            console.error(`[LEGACY Pix] status=${paymentStatusNormalized} status_detail=${statusDetail}`);

            if (paymentStatusNormalized === 'rejected' || paymentStatusNormalized === 'cancelled') {
                let userMessage = 'O Mercado Pago recusou a transação Pix.';
                if (statusDetail.includes('identification') || statusDetail.includes('cpf')) { // [cite: 262]
                    userMessage = 'CPF inválido ou não encontrado no Mercado Pago.';
                } else if (statusDetail.includes('high_risk') || statusDetail.includes('risk')) { // [cite: 263]
                    userMessage = 'Transação recusada por segurança. Tente novamente após alguns minutos.'; // [cite: 264]
                } else if (statusDetail.includes('duplicated')) {
                    userMessage = 'Pagamento duplicado detectado.';
                } // [cite: 265]
                return res.status(400).json({
                    success: false,
                    status: paymentStatusNormalized,
                    status_detail: statusDetail,
                    error: userMessage // [cite: 266]
                });
            } // [cite: 267]

            if (!transactionData.qr_code && !transactionData.qr_code_base64) {
                return res.status(400).json({
                    status: 'rejected',
                    error: 'Mercado Pago não retornou os dados do QR Code.'
                });
            } // [cite: 268]

            return res.status(200).json({
                success: true,
                paymentMethod: 'pix',
                status: paymentStatusNormalized,
                qr_code: transactionData.qr_code || transactionData.ticket_url || null,
                qr_code_base64: transactionData.qr_code_base64 || null, // [cite: 269]
                id: paymentResult.id,
                point_of_interaction: paymentResult.point_of_interaction
            });
        } // [cite: 270]

        return res.status(200).json({ success: true, id: paymentResult.id, status: paymentStatusNormalized });
    } catch (error) { // [cite: 271]
        console.error('[LEGACY] Erro crítico ao processar pagamento:', error);
        return res.status(500).json({ error: 'Erro crítico interno ao processar pagamento.', message: error.message }); // [cite: 272]
    } // [cite: 273]
}

// =========================================================
// HANDLER: handleSubscriptionSync (NOVO)
// POST /api/subscription/sync
// Reconcilia o status entre Mercado Pago e Supabase. [cite: 274]
// Corrige webhooks perdidos, status presos em 'pending', [cite: 275]
// e inconsistências após falhas de webhook.
// Acionado por: Vercel Cron Jobs (vercel.json) ou chamada manual. [cite: 276]
// Proteção: header Authorization: Bearer <SYNC_SECRET_KEY>
// Modos de uso:
//   1. userId no body → sincroniza um usuário específico
//   2. body vazio → sincroniza todos com status 'pending'
// =========================================================

async function handleSubscriptionSync(req, res) { // [cite: 276]
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
    } // [cite: 277]

    const authHeader = req.headers['authorization'] || ''; // [cite: 278]
    const syncSecret = process.env.SYNC_SECRET_KEY || '';

    if (!syncSecret) {
        console.error('[SubscriptionSync] SYNC_SECRET_KEY não configurado no Vercel.');
        return res.status(500).json({ error: 'Sync não configurado.' }); // [cite: 279]
    }

    if (authHeader !== `Bearer ${syncSecret}`) {
        console.warn('[SubscriptionSync] Acesso não autorizado.');
        return res.status(401).json({ error: 'Não autorizado.' }); // [cite: 280]
    }

    const { userId } = req.body || {};
    const startedAt = new Date().toISOString(); // [cite: 281]
    let cronRunId = null;

    try {
        const { data: cronRun } = await supabaseAdmin.from('cron_runs').insert([{
            job_name: 'subscription-sync',
            started_at: startedAt,
            status: 'running'
        }]).select('id').maybeSingle();
        cronRunId = cronRun?.id || null; // [cite: 282]
    } catch (_) { /* não bloqueia */ }

    try {
        let subscriptionsToSync = [];
        if (userId) { // [cite: 283]
            const { data } = await supabaseAdmin
                .from('subscriptions')
                .select('user_id, mp_subscription_id, status')
                .eq('user_id', userId)
                .maybeSingle(); // [cite: 284]
            if (data) subscriptionsToSync = [data];
        } else { // [cite: 285]
            const { data } = await supabaseAdmin
                .from('subscriptions')
                .select('user_id, mp_subscription_id, status')
                .eq('status', 'pending')
                .not('mp_subscription_id', 'is', null) // [cite: 286]
                .limit(50); // [cite: 287]
            subscriptionsToSync = data || []; // [cite: 288]
        }

        const results = [];
        let synced = 0;
        let skipped = 0; // [cite: 289]
        let errors = 0;

        for (const sub of subscriptionsToSync) {
            if (!sub.mp_subscription_id) { skipped++; continue; } // [cite: 290]

            try {
                const mpRes = await fetch(
                    `https://api.mercadopago.com/preapproval/${sub.mp_subscription_id}`,
                    { headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` } } // [cite: 291]
                );
                if (!mpRes.ok) { // [cite: 292]
                    console.warn(`[SubscriptionSync] Falha ao buscar preapproval/${sub.mp_subscription_id}: ${mpRes.status}`);
                    errors++; // [cite: 293]
                    results.push({ user_id: sub.user_id, error: `mp_status_${mpRes.status}` });
                    continue;
                }

                const mpData = await mpRes.json();
                const mpStatus = normalizeSubscriptionStatus(mpData.status); // [cite: 294]

                if (mpStatus === sub.status) {
                    skipped++;
                    results.push({ user_id: sub.user_id, action: 'noop', status: sub.status }); // [cite: 295]
                    continue;
                }

                console.log(`[SubscriptionSync] Divergencia: userId=${sub.user_id} | supabase=${sub.status} | mp=${mpStatus}`);
                if (mpStatus === 'authorized') { // [cite: 296]
                    await SubscriptionBillingEngine.handleAuthorized(sub.user_id, sub.mp_subscription_id, mpData);
                } else if (mpStatus === 'paused') { // [cite: 297]
                    await SubscriptionBillingEngine.handlePaused(sub.user_id, sub.mp_subscription_id, mpData);
                } else if (mpStatus === 'cancelled') { // [cite: 298]
                    await SubscriptionBillingEngine.handleCancelled(sub.user_id, sub.mp_subscription_id, mpData);
                } else if (mpStatus === 'expired') { // [cite: 299]
                    await SubscriptionBillingEngine.handleExpired(sub.user_id, sub.mp_subscription_id, mpData);
                } else { // [cite: 300]
                    await supabaseAdmin.from('subscriptions').update({
                        status: mpStatus,
                        last_webhook_at: new Date().toISOString()
                    }).eq('user_id', sub.user_id); // [cite: 301]
                    await SubscriptionBillingEngine.logEvent( // [cite: 302]
                        sub.mp_subscription_id,
                        `sync.status_updated.${mpStatus}`,
                        { user_id: sub.user_id, previous: sub.status, current: mpStatus }
                    );
                }

                synced++;
                results.push({ user_id: sub.user_id, action: 'synced', from: sub.status, to: mpStatus }); // [cite: 304]
            } catch (subErr) { // [cite: 305]
                console.error(`[SubscriptionSync] Erro ao sincronizar userId=${sub.user_id}:`, subErr.message);
                errors++; // [cite: 306]
                results.push({ user_id: sub.user_id, error: subErr.message });
            }
        }

        const summary = { total: subscriptionsToSync.length, synced, skipped, errors };
        console.log('[SubscriptionSync] Concluído:', summary); // [cite: 307]

        if (cronRunId) {
            await supabaseAdmin.from('cron_runs').update({
                finished_at: new Date().toISOString(),
                status: errors > 0 ? 'partial' : 'success',
                result: { summary, results }
            }).eq('id', cronRunId).catch(() => { }); // [cite: 308]
        }

        return res.status(200).json({ success: true, ...summary, results });
    } catch (err) { // [cite: 309]
        console.error('[SubscriptionSync] Erro crítico:', err);
        if (cronRunId) { // [cite: 310]
            await supabaseAdmin.from('cron_runs').update({
                finished_at: new Date().toISOString(),
                status: 'error',
                result: { error: err.message }
            }).eq('id', cronRunId).catch(() => { });
        }

        return res.status(500).json({ error: 'Erro ao executar sincronização.', message: err.message }); // [cite: 311]
    }
}

// =========================================================
// HANDLER: handleAccessCheck
// =========================================================

async function handleAccessCheck(req, res) { // [cite: 312]
    res.status(200).json({ status: 'free', isPro: false });
}

// =========================================================
// ROUTER PRINCIPAL
// =========================================================

export default async function handler(req, res) { // [cite: 313]
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Credentials', 'true'); // [cite: 314]
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,PUT,PATCH,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Idempotency-Key, X-Trace-Id');
    if (req.method === 'OPTIONS') { // [cite: 315]
        return res.status(200).end();
    }

    const route = Array.isArray(req.query.routes) // [cite: 316]
        ? req.query.routes.join('/')
        : (req.query.routes || ''); // [cite: 317]
    // 🔒 Bloqueia acesso a rotas sensíveis
    const blockedPatterns = ['.env', '.git', 'config', 'secrets', 'credentials']; // [cite: 318]
    if (blockedPatterns.some(p => route.toLowerCase().includes(p))) { // [cite: 319]
        console.warn(`[Security] Acesso bloqueado: ${route} | IP: ${req.headers['x-forwarded-for'] || 'desconhecido'}`);
        return res.status(403).json({ error: 'Acesso negado.' }); // [cite: 320]
    }

    try {
        // ── NOVAS ROTAS DE ASSINATURA ──────────────────────────────────────
        if (route === 'subscription/create') {
            await handleSubscriptionCreate(req, res); // [cite: 321]
        } else if (route === 'subscription/status') {
            await handleSubscriptionStatus(req, res); // [cite: 322]
            // ── SYNC / RECONCILIAÇÃO (Vercel Cron + manual) ─────────────────
        } else if (route === 'subscription/sync') {
            await handleSubscriptionSync(req, res); // [cite: 323]
            // ── WEBHOOK (preapproval + payment) ───────────────────────────────
        } else if (route === 'webhooks/mercadopago' || route === 'webhook/mercadopago') {
            await handleWebhookMercadoPago(req, res); // [cite: 324]
            // ── ACESSO ────────────────────────────────────────────────────────
        } else if (route === 'access/check' || route === 'auth/check-access') {
            await handleAccessCheck(req, res); // [cite: 325]
            // ── LEGACY PAYMENT FLOW ───────────────────────────────────────────
        } else if (route === 'payments/create') {
            // LEGACY PAYMENT FLOW — mantido para compatibilidade
            await handlePaymentsCreate(req, res, route); // [cite: 326]
            // ── HEALTH CHECK ──────────────────────────────────────────────────
        } else if (route === '' || route === 'health') {
            res.status(200).json({ status: 'online', ts: new Date().toISOString() }); // [cite: 327]
        } else {
            console.warn(`[Router] Rota não encontrada: ${route}`);
            res.status(404).json({ error: `Rota não encontrada: ${route}` }); // [cite: 328]
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro interno.', message: error.message }); // [cite: 329]
    }
}