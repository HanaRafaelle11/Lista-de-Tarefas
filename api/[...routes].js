import crypto from 'crypto';
// NOTA: MPPayment mantido para o fluxo LEGACY de pagamentos avulsos.
// O novo fluxo de assinaturas usa fetch direto à API REST do Mercado Pago.
import { MercadoPagoConfig, Payment as MPPayment } from 'mercadopago';

import { supabaseAdmin } from '../lib/supabase.js';

// =========================================================
// UTILITÁRIOS DE SEGURANÇA E MASCARAMENTO
// =========================================================

const maskEmail = (email) => {
    if (!email) return '';
    const [user, domain] = email.split('@');
    return `${user.substring(0, 3)}***@${domain}`;
};

const maskCpf = (cpf) => {
    if (!cpf) return '';
    return `***.${cpf.substring(3, 6)}.${cpf.substring(6, 9)}-**`;
};

const isGenericName = (name) => {
    const genericNames = ['teste', 'test', 'usuario', 'user', 'admin'];
    return genericNames.includes(name.toLowerCase().trim());
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
        'charged_back': 'refunded'
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
    if (!status) return null;
    const normalized = subscriptionStatusMap[status];
    if (!normalized) {
        console.warn(`[normalizeSubscriptionStatus] Status desconhecido do MP: "${status}" — preservando como recebido.`);
        return status; // preserva status desconhecido em vez de assumir valor padrão
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
        const allowed = this.transitions[current] || [];
        if (allowed.includes(next) || current === next) return next;
        console.warn('[PaymentStateMachine] Transição inválida de ' + current + ' para ' + next);
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
        const now = new Date();
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
            metadata: { payment_id: paymentIdStr, date_approved: now.toISOString() },
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
        }).eq('id', userId);

        // LEGACY PAYMENT FLOW — subscriptions upsert
        await supabaseAdmin.from('subscriptions').upsert({
            user_id: userId,
            status: 'active',
            plan: 'premium',
            price: 14.90,
            current_period_start: now.toISOString(),
            current_period_end: expiresAt,
            last_payment_id: paymentIdStr,
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
                created_at: new Date().toISOString()
            }]);
        } catch (logErr) {
            console.error(`[SubscriptionBillingEngine.logEvent] Falha ao registrar evento "${eventType}":`, logErr.message);
        }
    },

    // Ativa premium: status authorized
    async handleAuthorized(userId, mpSubscriptionId, subscriptionResult) {
        if (!userId || !mpSubscriptionId) return;
        const now = new Date().toISOString();

        const nextBillingDate = subscriptionResult.next_payment_date || null;

        // DENORMALIZAÇÃO — fonte de verdade é subscriptions.status
        // profiles.assinatura_status existe apenas para leitura rápida no frontend
        await supabaseAdmin.from('profiles').update({
            plano: 'premium',
            assinatura_status: 'authorized',
            assinatura_inicio: now,
            assinatura_expira_em: nextBillingDate,
            mercadopago_customer_id: subscriptionResult.payer_id
                ? String(subscriptionResult.payer_id)
                : null,
            updated_at: now
        }).eq('id', userId);

        await supabaseAdmin.from('subscriptions').upsert({
            user_id: userId,
            mp_subscription_id: mpSubscriptionId,
            status: 'authorized',
            plan: 'premium',
            amount: 14.90,
            next_billing_date: nextBillingDate,
            payer_id: subscriptionResult.payer_id
                ? String(subscriptionResult.payer_id)
                : null,
            provider: 'mercado_pago',
            updated_at: now
        }, { onConflict: 'user_id' });

        await this.logEvent(mpSubscriptionId, 'subscription.authorized', {
            user_id: userId,
            next_payment_date: nextBillingDate,
            date_created: subscriptionResult.date_created || now
        });

        console.log(`[SubscriptionBillingEngine] ✅ Premium ATIVADO para userId=${userId} | sub=${mpSubscriptionId}`);
    },

    // Renova premium: pagamento recorrente aprovado
    async handlePaymentApproved(userId, mpSubscriptionId, paymentId, amount) {
        if (!userId) return;
        const now = new Date();
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const nextBillingDate = nextMonth.toISOString();
        const nowIso = now.toISOString();

        // DENORMALIZAÇÃO — fonte de verdade é subscriptions.status
        await supabaseAdmin.from('profiles').update({
            plano: 'premium',
            assinatura_status: 'authorized',
            assinatura_expira_em: nextBillingDate,
            updated_at: nowIso
        }).eq('id', userId);

        await supabaseAdmin.from('subscriptions').upsert({
            user_id: userId,
            mp_subscription_id: mpSubscriptionId,
            status: 'authorized',
            plan: 'premium',
            amount: amount || 14.90,
            next_billing_date: nextBillingDate,
            last_payment_date: nowIso,
            last_payment_id: paymentId ? String(paymentId) : null,
            provider: 'mercado_pago',
            updated_at: nowIso
        }, { onConflict: 'user_id' });

        await this.logEvent(mpSubscriptionId, 'subscription.payment_approved', {
            user_id: userId,
            payment_id: paymentId,
            amount: amount,
            next_billing_date: nextBillingDate
        });

        console.log(`[SubscriptionBillingEngine] 💰 Renovação registrada para userId=${userId} | sub=${mpSubscriptionId}`);
    },

    // Suspende acesso: status paused
    async handlePaused(userId, mpSubscriptionId, rawPayload) {
        if (!userId) return;
        const now = new Date().toISOString();

        // DENORMALIZAÇÃO — fonte de verdade é subscriptions.status
        await supabaseAdmin.from('profiles').update({
            assinatura_status: 'paused',
            updated_at: now
        }).eq('id', userId);

        await supabaseAdmin.from('subscriptions').upsert({
            user_id: userId,
            mp_subscription_id: mpSubscriptionId,
            status: 'paused',
            updated_at: now
        }, { onConflict: 'user_id' });

        await this.logEvent(mpSubscriptionId, 'subscription.paused', {
            user_id: userId,
            raw: rawPayload
        });

        console.warn(`[SubscriptionBillingEngine] ⏸ Acesso SUSPENSO para userId=${userId} | sub=${mpSubscriptionId}`);
    },

    // Cancela acesso: status cancelled
    async handleCancelled(userId, mpSubscriptionId, rawPayload) {
        if (!userId) return;
        const now = new Date().toISOString();

        // DENORMALIZAÇÃO — fonte de verdade é subscriptions.status
        await supabaseAdmin.from('profiles').update({
            plano: 'free',
            assinatura_status: 'cancelled',
            updated_at: now
        }).eq('id', userId);

        await supabaseAdmin.from('subscriptions').upsert({
            user_id: userId,
            mp_subscription_id: mpSubscriptionId,
            status: 'cancelled',
            updated_at: now
        }, { onConflict: 'user_id' });

        await this.logEvent(mpSubscriptionId, 'subscription.cancelled', {
            user_id: userId,
            raw: rawPayload
        });

        console.warn(`[SubscriptionBillingEngine] ❌ Acesso CANCELADO para userId=${userId} | sub=${mpSubscriptionId}`);
    },

    // Expira acesso: status expired
    async handleExpired(userId, mpSubscriptionId, rawPayload) {
        if (!userId) return;
        const now = new Date().toISOString();

        // DENORMALIZAÇÃO — fonte de verdade é subscriptions.status
        await supabaseAdmin.from('profiles').update({
            plano: 'free',
            assinatura_status: 'expired',
            updated_at: now
        }).eq('id', userId);

        await supabaseAdmin.from('subscriptions').upsert({
            user_id: userId,
            mp_subscription_id: mpSubscriptionId,
            status: 'expired',
            updated_at: now
        }, { onConflict: 'user_id' });

        await this.logEvent(mpSubscriptionId, 'subscription.expired', {
            user_id: userId,
            raw: rawPayload
        });

        console.warn(`[SubscriptionBillingEngine] ⌛ Acesso EXPIRADO para userId=${userId} | sub=${mpSubscriptionId}`);
    },

    // Cobrança revertida (chargeback em pagamento recorrente)
    async handleChargedBack(userId, mpSubscriptionId, paymentId, rawPayload) {
        if (!userId) return;
        const now = new Date().toISOString();

        // DENORMALIZAÇÃO — fonte de verdade é subscriptions.status
        await supabaseAdmin.from('profiles').update({
            assinatura_status: 'paused',
            updated_at: now
        }).eq('id', userId);

        await supabaseAdmin.from('subscriptions').upsert({
            user_id: userId,
            mp_subscription_id: mpSubscriptionId,
            status: 'paused',
            updated_at: now
        }, { onConflict: 'user_id' });

        await this.logEvent(mpSubscriptionId, 'payment.charged_back', {
            user_id: userId,
            payment_id: paymentId,
            raw: rawPayload
        });

        console.error(`[SubscriptionBillingEngine] 🔴 Chargeback detectado para userId=${userId} | sub=${mpSubscriptionId}`);
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
// Consulta a tabela subscriptions e verifica se o usuário
// tem status "authorized". Todos os demais status bloqueiam.
// =========================================================

async function checkPremiumAccess(userId) {
    if (!userId) return { allowed: false, reason: 'userId ausente' };

    try {
        const { data: subscription, error } = await supabaseAdmin
            .from('subscriptions')
            .select('status, mp_subscription_id, next_billing_date')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            console.error('[checkPremiumAccess] Erro ao consultar subscriptions:', error.message);
            return { allowed: false, reason: 'erro_db' };
        }

        if (!subscription) {
            return { allowed: false, reason: 'sem_assinatura' };
        }

        const allowedStatuses = ['authorized'];
        const blockedStatuses = ['paused', 'cancelled', 'expired', 'pending', 'payment_required'];

        if (allowedStatuses.includes(subscription.status)) {
            return {
                allowed: true,
                status: subscription.status,
                mp_subscription_id: subscription.mp_subscription_id,
                next_billing_date: subscription.next_billing_date
            };
        }

        if (blockedStatuses.includes(subscription.status)) {
            return {
                allowed: false,
                reason: `status_bloqueado:${subscription.status}`,
                status: subscription.status
            };
        }

        // Status desconhecido — nega acesso por segurança
        return { allowed: false, reason: `status_desconhecido:${subscription.status}` };
    } catch (err) {
        console.error('[checkPremiumAccess] Exceção:', err.message);
        return { allowed: false, reason: 'excecao_interna' };
    }
}

// =========================================================
// HANDLER: handleSubscriptionCreate (NOVO)
// POST /api/subscription/create
// Chama POST https://api.mercadopago.com/preapproval
// =========================================================

async function handleSubscriptionCreate(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
    }

    try {
        const {
            card_token_id,
            email,
            cpf,
            userId,
            firstName,
            lastName
        } = req.body || {};

        // Validações de entrada
        if (!userId) {
            return res.status(400).json({ error: 'userId é obrigatório.' });
        }
        if (!card_token_id) {
            return res.status(400).json({ error: 'card_token_id é obrigatório.' });
        }
        if (!email) {
            return res.status(400).json({ error: 'email é obrigatório.' });
        }
        if (!cpf) {
            return res.status(400).json({ error: 'cpf é obrigatório.' });
        }

        const cleanCpf = cpf.replace(/\D/g, '');
        if (cleanCpf.length !== 11) {
            return res.status(400).json({ error: 'CPF inválido. Deve conter 11 dígitos.' });
        }

        // Resolução do nome: payload > perfil Supabase
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

        if (!first_name || !last_name || isGenericName(first_name) || isGenericName(last_name)) {
            return res.status(400).json({ error: 'Nome e sobrenome válidos são obrigatórios.' });
        }

        // Idempotência: verifica se já existe assinatura authorized para este userId
        const { data: existingSub } = await supabaseAdmin
            .from('subscriptions')
            .select('mp_subscription_id, status, next_billing_date')
            .eq('user_id', userId)
            .maybeSingle();

        if (existingSub && existingSub.status === 'authorized' && existingSub.mp_subscription_id) {
            console.log(`[handleSubscriptionCreate] Assinatura já ativa para userId=${userId}`);
            return res.status(200).json({
                success: true,
                alreadyExists: true,
                mp_subscription_id: existingSub.mp_subscription_id,
                status: 'authorized',
                next_payment_date: existingSub.next_billing_date
            });
        }

        // Payload da Preapproval API do Mercado Pago
        const preapprovalPayload = {
            reason: 'MyFlowDay Premium',
            payer_email: email.trim(),
            card_token_id: card_token_id,
            status: 'authorized',
            auto_recurring: {
                frequency: 1,
                frequency_type: 'months',
                transaction_amount: 14.90,
                currency_id: 'BRL'
            },
            // Identificação do pagador
            payer: {
                email: email.trim(),
                identification: {
                    type: 'CPF',
                    number: cleanCpf
                }
            },
            // external_reference para rastrear no webhook
            external_reference: `mfd_premium_${userId}`,
            // URL de retorno do webhook
            notification_url: process.env.MP_WEBHOOK_URL
                || 'https://myflowday.com.br/api/webhooks/mercadopago'
        };

        console.log('[handleSubscriptionCreate] Enviando para /preapproval:', {
            payer_email: maskEmail(email),
            has_token: !!card_token_id,
            cpf: maskCpf(cleanCpf),
            userId: userId
        });

        // Idempotency key estável por userId — impede criação duplicada em double-click ou retry.
        // Usar userId como chave garante que a mesma requisição do mesmo usuário seja
        // deduplicada pelo Mercado Pago durante a janela de idempotência (tipicamente 24h).
        const idempotencyKey = `subscription_create_${userId}`;

        // ── [MP DEBUG] Diagnóstico temporário — remover após identificar causa do erro 404 ──
        console.log('[MP DEBUG] MP_ACCESS_TOKEN existe?', !!process.env.MP_ACCESS_TOKEN);
        console.log('[MP DEBUG] Prefixo token:', process.env.MP_ACCESS_TOKEN?.substring(0, 10));
        console.log('[MP DEBUG] card_token_id:', card_token_id);
        console.log('[MP DEBUG] email:', email);
        console.log('[MP DEBUG] cpf:', cleanCpf);
        console.log('[MP DEBUG] first_name:', first_name);
        console.log('[MP DEBUG] last_name:', last_name);
        console.log('[MP DEBUG] preapprovalPayload:', JSON.stringify(preapprovalPayload, null, 2));
        // ── fim [MP DEBUG] ───────────────────────────────────────────────────────────────

        // Chama a API REST do Mercado Pago diretamente
        const mpResponse = await fetch('https://api.mercadopago.com/preapproval', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': idempotencyKey
            },
            body: JSON.stringify(preapprovalPayload)
        });

        const mpData = await mpResponse.json();

        // ── [MP DEBUG] Diagnóstico temporário — remover após identificar causa do erro 404 ──
        console.log('[MP DEBUG] HTTP Status:', mpResponse.status);
        console.log('[MP DEBUG] MP Response:', JSON.stringify(mpData, null, 2));
        // ── fim [MP DEBUG] ───────────────────────────────────────────────────────────────

        if (!mpResponse.ok) {
            console.error('[handleSubscriptionCreate] Erro MP:', JSON.stringify(mpData));

            // Log do erro na subscription_logs mesmo em falha
            await SubscriptionBillingEngine.logEvent(null, 'subscription.create_failed', {
                user_id: userId,
                mp_error: mpData,
                status_code: mpResponse.status
            });

            return res.status(400).json({
                error: mpData.message || 'Falha ao criar assinatura no Mercado Pago.',
                mp_status: mpResponse.status,
                details: mpData
            });
        }

        const mpSubscriptionId = mpData.id;
        const subscriptionStatus = normalizeSubscriptionStatus(mpData.status);
        const nextPaymentDate = mpData.next_payment_date || null;
        const payerId = mpData.payer_id ? String(mpData.payer_id) : null;
        const now = new Date().toISOString();

        console.log(`[handleSubscriptionCreate] MP retornou: id=${mpSubscriptionId} status=${subscriptionStatus}`);

        // SOURCE OF TRUTH: salva sempre 'pending' no Supabase ao criar.
        // O webhook é o único responsável por mover para 'authorized'.
        // Estratégia híbrida: o status real do MP é retornado ao frontend
        // (que pode mostrar 'Ativada!' se MP retornar authorized imediatamente),
        // mas o banco fica 'pending' até o webhook confirmar.
        const { error: upsertError } = await supabaseAdmin.from('subscriptions').upsert({
            user_id: userId,
            mp_subscription_id: mpSubscriptionId,
            status: 'pending',              // sempre pending — webhook atualiza
            plan: 'premium',
            amount: 14.90,
            next_billing_date: nextPaymentDate,
            payer_id: payerId,
            provider: 'mercado_pago',
            webhook_payload: mpData,
            updated_at: now
        }, { onConflict: 'user_id' });

        if (upsertError) {
            console.error('[handleSubscriptionCreate] Erro ao salvar no Supabase:', upsertError.message);
            // Não bloqueia o retorno — assinatura foi criada no MP
        }

        // Loga a criação independente do status
        // NÃO aciona handleAuthorized aqui — apenas o webhook deve fazer isso
        await SubscriptionBillingEngine.logEvent(mpSubscriptionId, `subscription.created.${subscriptionStatus}`, {
            user_id: userId,
            mp_status: mpData.status,
            next_payment_date: nextPaymentDate
        });

        return res.status(200).json({
            success: true,
            mp_subscription_id: mpSubscriptionId,
            status: subscriptionStatus,   // status real do MP para o frontend
            next_payment_date: nextPaymentDate,
            date_created: mpData.date_created || now
        });

    } catch (error) {
        console.error('[handleSubscriptionCreate] Erro crítico:', error);
        return res.status(500).json({
            error: 'Erro interno ao criar assinatura.',
            message: error.message
        });
    }
}

// =========================================================
// HANDLER: handleSubscriptionStatus (NOVO)
// GET /api/subscription/status?userId=...
// Consulta status atual da assinatura do usuário
// =========================================================

async function handleSubscriptionStatus(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método não permitido. Utilize GET.' });
    }

    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).json({ error: 'userId é obrigatório.' });
    }

    try {
        const access = await checkPremiumAccess(userId);

        if (access.allowed) {
            return res.status(200).json({
                isPremium: true,
                status: access.status,
                mp_subscription_id: access.mp_subscription_id,
                next_billing_date: access.next_billing_date
            });
        }

        return res.status(200).json({
            isPremium: false,
            status: access.status || null,
            reason: access.reason
        });
    } catch (err) {
        console.error('[handleSubscriptionStatus] Erro:', err.message);
        return res.status(500).json({ error: 'Erro ao verificar status da assinatura.' });
    }
}

// =========================================================
// VALIDAÇÃO DE ASSINATURA DO WEBHOOK (MP_VALIDATE_SIGNATURE)
// Suporte a x-signature e x-request-id do Mercado Pago.
// Ativação: configure MP_VALIDATE_SIGNATURE=true no Vercel
// e MP_WEBHOOK_SECRET com o secret gerado no painel do MP.
// Por padrão desativado (MP_VALIDATE_SIGNATURE=false) para
// facilitar a homologação sem configuração adicional.
// =========================================================

function validateMercadoPagoWebhook(req) {
    const signatureEnabled = process.env.MP_VALIDATE_SIGNATURE === 'true';

    if (!signatureEnabled) {
        // Validação desativada — aceitar todos os webhooks
        return { valid: true, skipped: true };
    }

    try {
        const xSignature = req.headers['x-signature'] || '';
        const xRequestId = req.headers['x-request-id'] || '';
        const webhookSecret = process.env.MP_WEBHOOK_SECRET || '';

        if (!webhookSecret) {
            console.warn('[validateMercadoPagoWebhook] MP_WEBHOOK_SECRET não configurado. Ignorando validação.');
            return { valid: true, skipped: true, reason: 'secret_not_configured' };
        }

        if (!xSignature) {
            console.warn('[validateMercadoPagoWebhook] Header x-signature ausente.');
            return { valid: false, reason: 'missing_x_signature' };
        }

        // Extrai ts e v1 do header x-signature
        // Formato: ts=<timestamp>,v1=<hash>
        const parts = {};
        xSignature.split(',').forEach(part => {
            const [key, value] = part.split('=');
            if (key && value) parts[key.trim()] = value.trim();
        });

        const { ts, v1 } = parts;
        if (!ts || !v1) {
            return { valid: false, reason: 'invalid_x_signature_format' };
        }

        // Monta a string de assinatura conforme documentação MP
        // Formato: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
        const dataId = req.body?.data?.id || req.body?.id || '';
        const signatureString = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

        // HMAC-SHA256
        const expectedHash = crypto
            .createHmac('sha256', webhookSecret)
            .update(signatureString)
            .digest('hex');

        if (expectedHash !== v1) {
            console.error('[validateMercadoPagoWebhook] Assinatura inválida!');
            return { valid: false, reason: 'signature_mismatch' };
        }

        return { valid: true, skipped: false };
    } catch (err) {
        console.error('[validateMercadoPagoWebhook] Exceção:', err.message);
        return { valid: false, reason: 'exception', error: err.message };
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
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
    }

    const requestTraceId = req.headers['x-trace-id'] || crypto.randomUUID();
    const body = req.body || {};

    console.log(`[Webhook] Recebido: type=${body.type} | topic=${body.topic} | traceId=${requestTraceId}`);

    // ── Validação de assinatura do webhook (ativado via MP_VALIDATE_SIGNATURE=true) ──
    // PRODUÇÃO: obrigatório ativar MP_VALIDATE_SIGNATURE=true + MP_WEBHOOK_SECRET
    const signatureCheck = validateMercadoPagoWebhook(req);
    if (!signatureCheck.valid) {
        console.error(`[Webhook] Assinatura inválida: ${signatureCheck.reason}`);
        await SubscriptionBillingEngine.logEvent(null, 'webhook.signature_rejected', {
            reason: signatureCheck.reason,
            type: body.type
        });
        return res.status(401).json({ error: 'Assinatura do webhook inválida.' });
    }

    // ── IDEMPOTÊNCIA: garante processamento exatamente uma vez ──────────
    // Usa body.id (ID único da notificação MP) como chave primária.
    // Fallback composto quando body.id não está presente (eventos legados).
    const eventId = body.id
        ? String(body.id)
        : `${body.type || body.topic || 'unknown'}_${body.data?.id || 'noid'}_${body.action || 'event'}`;

    try {
        const { data: alreadyProcessed } = await supabaseAdmin
            .from('webhook_events')
            .select('id, processed_at')
            .eq('event_id', eventId)
            .maybeSingle();

        if (alreadyProcessed) {
            console.log(`[Webhook] Evento já processado (idempotência): eventId=${eventId} | processedAt=${alreadyProcessed.processed_at}`);
            return res.status(200).json({ message: 'Evento já processado.', idempotent: true });
        }
    } catch (idempotencyErr) {
        // Se a tabela ainda não existe (migration pendente), loga mas não bloqueia
        console.warn('[Webhook] Aviso de idempotência (execute migration v21):', idempotencyErr.message);
    }

    return await BillingTracer.runWithTrace(requestTraceId, async () => {
        try {
            // ── Evento de ASSINATURA (preapproval) ──────────────────────────
            if (body.type === 'preapproval' || body.topic === 'preapproval') {
                const preapprovalId = body.data?.id || body.id;

                if (!preapprovalId) {
                    await SubscriptionBillingEngine.logEvent(null, 'webhook.preapproval.missing_id', { body });
                    return res.status(200).json({ message: 'Evento preapproval sem ID recebido.' });
                }

                const preapprovalIdStr = String(preapprovalId);

                // Busca detalhes da assinatura na API do MP
                const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalIdStr}`, {
                    headers: {
                        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`
                    }
                });

                if (!mpRes.ok) {
                    console.error(`[Webhook] Falha ao buscar preapproval/${preapprovalIdStr}`);
                    await SubscriptionBillingEngine.logEvent(preapprovalIdStr, 'webhook.preapproval.fetch_failed', {
                        http_status: mpRes.status
                    });
                    return res.status(200).json({ message: 'Falha ao buscar preapproval no MP.' });
                }

                const preapprovalData = await mpRes.json();
                const subscriptionStatus = normalizeSubscriptionStatus(preapprovalData.status);
                const externalRef = preapprovalData.external_reference || '';

                // Resolve userId via external_reference (mfd_premium_<userId>)
                // ou busca diretamente na tabela subscriptions
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

                // Atualiza last_webhook_at e webhook_payload em subscriptions
                const now = new Date().toISOString();
                await supabaseAdmin.from('subscriptions').upsert({
                    user_id: userId,
                    mp_subscription_id: preapprovalIdStr,
                    status: subscriptionStatus,
                    last_webhook_at: now,
                    webhook_payload: preapprovalData,
                    updated_at: now
                }, { onConflict: 'mp_subscription_id' });

                // Aciona SubscriptionBillingEngine conforme status
                if (subscriptionStatus === 'authorized') {
                    await SubscriptionBillingEngine.handleAuthorized(userId, preapprovalIdStr, preapprovalData);
                } else if (subscriptionStatus === 'paused') {
                    await SubscriptionBillingEngine.handlePaused(userId, preapprovalIdStr, preapprovalData);
                } else if (subscriptionStatus === 'cancelled') {
                    await SubscriptionBillingEngine.handleCancelled(userId, preapprovalIdStr, preapprovalData);
                } else if (subscriptionStatus === 'expired') {
                    await SubscriptionBillingEngine.handleExpired(userId, preapprovalIdStr, preapprovalData);
                } else {
                    // payment_required, pending ou status desconhecido
                    await SubscriptionBillingEngine.logEvent(preapprovalIdStr, `preapproval.${subscriptionStatus || 'unknown'}`, {
                        user_id: userId,
                        mp_status: preapprovalData.status,
                        raw: preapprovalData
                    });
                    console.warn(`[Webhook] Status de preapproval não mapeado: ${preapprovalData.status}`);
                }

                return res.status(200).json({
                    success: true,
                    event: 'preapproval',
                    preapprovalId: preapprovalIdStr,
                    status: subscriptionStatus
                });
            }

            // ── Salva evento na webhook_events após processar preapproval com sucesso ──
            await supabaseAdmin.from('webhook_events').insert([{
                event_id: eventId,
                event_type: body.type || 'preapproval',
                resource_id: preapprovalIdStr,
                payload: body
            }]).catch((e) => console.warn('[Webhook] Não foi possível salvar webhook_events:', e.message));

            // ── Evento de PAGAMENTO recorrente (payment) ────────────────────
            if (body.type === 'payment' || body.topic === 'payment') {
                const paymentId = body.data?.id || body.id;

                if (!paymentId) {
                    await SubscriptionBillingEngine.logEvent(null, 'webhook.payment.missing_id', { body });
                    return res.status(200).json({ message: 'Evento payment sem ID recebido.' });
                }

                const paymentIdStr = String(paymentId);

                // Busca detalhes do pagamento na API do MP
                const mpPayRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentIdStr}`, {
                    headers: {
                        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`
                    }
                });

                if (!mpPayRes.ok) {
                    await SubscriptionBillingEngine.logEvent(null, 'webhook.payment.fetch_failed', {
                        payment_id: paymentIdStr,
                        http_status: mpPayRes.status
                    });
                    return res.status(200).json({ message: 'Falha ao buscar payment no MP.' });
                }

                const paymentData = await mpPayRes.json();
                const paymentStatus = normalizeStatus(paymentData.status);

                // Resolve userId via metadata ou external_reference
                let userId = paymentData.metadata?.user_id || null;
                const externalRef = paymentData.external_reference || '';

                if (!userId && externalRef.startsWith('mfd_premium_')) {
                    userId = externalRef.replace('mfd_premium_', '');
                }

                // Resolve mp_subscription_id via preapproval_id no payment (se disponível)
                const mpSubscriptionId = paymentData.preapproval_id
                    ? String(paymentData.preapproval_id)
                    : null;

                if (!userId && mpSubscriptionId) {
                    const { data: subRow } = await supabaseAdmin
                        .from('subscriptions')
                        .select('user_id')
                        .eq('mp_subscription_id', mpSubscriptionId)
                        .maybeSingle();
                    userId = subRow?.user_id || null;
                }

                // Loga TODOS os eventos de payment em subscription_logs
                await SubscriptionBillingEngine.logEvent(
                    mpSubscriptionId,
                    `payment.${paymentData.status || 'unknown'}`,
                    {
                        payment_id: paymentIdStr,
                        user_id: userId,
                        status: paymentData.status,
                        status_detail: paymentData.status_detail,
                        transaction_amount: paymentData.transaction_amount,
                        date_approved: paymentData.date_approved,
                        preapproval_id: mpSubscriptionId
                    }
                );

                // Atualiza last_webhook_at em subscriptions
                if (mpSubscriptionId) {
                    await supabaseAdmin.from('subscriptions')
                        .update({
                            last_webhook_at: new Date().toISOString(),
                            last_payment_date: paymentData.date_approved || new Date().toISOString()
                        })
                        .eq('mp_subscription_id', mpSubscriptionId);
                }

                // Aciona engine conforme status do payment
                if (paymentStatus === 'approved' && userId) {
                    await SubscriptionBillingEngine.handlePaymentApproved(
                        userId,
                        mpSubscriptionId,
                        paymentIdStr,
                        paymentData.transaction_amount
                    );
                } else if (paymentStatus === 'refunded' && userId) {
                    await SubscriptionBillingEngine.handleChargedBack(userId, mpSubscriptionId, paymentIdStr, paymentData);
                } else {
                    console.warn(`[Webhook] Payment ${paymentIdStr} com status="${paymentData.status}" — sem ação automática.`);
                }

                return res.status(200).json({
                    success: true,
                    event: 'payment',
                    paymentId: paymentIdStr,
                    status: paymentData.status
                });
            }

            // ── Salva evento na webhook_events após processar payment com sucesso ──
            await supabaseAdmin.from('webhook_events').insert([{
                event_id: eventId,
                event_type: body.type || 'payment',
                resource_id: paymentIdStr,
                payload: body
            }]).catch((e) => console.warn('[Webhook] Não foi possível salvar webhook_events:', e.message));

            // ── Evento desconhecido — loga e responde 200 ───────────────────
            await SubscriptionBillingEngine.logEvent(null, `webhook.unknown.${body.type || 'no_type'}`, { body });
            console.warn(`[Webhook] Evento não reconhecido: type=${body.type} topic=${body.topic}`);

            // Salva na webhook_events mesmo sem processar (evita reprocessamento futuro)
            await supabaseAdmin.from('webhook_events').insert([{
                event_id: eventId,
                event_type: body.type || body.topic || 'unknown',
                resource_id: String(body.data?.id || ''),
                payload: body
            }]).catch(() => {});

            return res.status(200).json({ message: 'Evento recebido e logado, mas não processado.' });

        } catch (webhookErr) {
            console.error('[Webhook] Erro crítico:', webhookErr);

            // Tenta logar o erro mesmo em caso de exceção
            try {
                await SubscriptionBillingEngine.logEvent(null, 'webhook.critical_error', {
                    error: webhookErr.message,
                    body
                });
            } catch (_) { /* silencia falha no log de fallback */ }

            return res.status(500).json({ error: 'Erro ao processar o webhook.' });
        }
    });
}

// =========================================================
// HANDLER: handlePaymentsCreate — LEGACY PAYMENT FLOW
// Mantido para compatibilidade com fluxos anteriores.
// NÃO usar para novos cadastros. Use handleSubscriptionCreate.
// =========================================================

// LEGACY PAYMENT FLOW
async function handlePaymentsCreate(req, res, routePath) {
    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
        }

        // LEGACY PAYMENT FLOW
        const { userId, email: emailRoot, amount, payment_method_id, token, installments, cpf: cpfRoot, deviceId, external_reference, metadata, payer } = req.body || {};
        const idempotencyKey = req.headers['x-idempotency-key'] || crypto.randomUUID();

        const email = emailRoot || payer?.email || '';
        const cpf = cpfRoot || payer?.identification?.number || '';
        const payerFirstName = payer?.first_name || '';
        const payerLastName = payer?.last_name || '';

        if (!userId || !email || !payment_method_id) {
            return res.status(400).json({ error: 'Campos obrigatórios em falta: userId, email ou payment_method_id.' });
        }

        const cleanCpf = cpf ? cpf.replace(/\D/g, '') : '';
        let first_name = payerFirstName;
        let last_name = payerLastName;

        if (!first_name || !last_name) {
            try {
                const { data: profile } = await supabaseAdmin
                    .from('profiles')
                    .select('name, nickname')
                    .eq('id', userId)
                    .maybeSingle();

                const fullName = profile?.name || profile?.nickname;
                if (fullName) {
                    const parts = fullName.trim().split(/\s+/);
                    first_name = first_name || parts[0] || '';
                    last_name = last_name || parts.slice(1).join(' ') || '';
                }
            } catch (err) {
                console.warn(`[LEGACY] Falha ao procurar perfil:`, err.message);
            }
        }

        if (!first_name || !last_name || isGenericName(first_name) || isGenericName(last_name)) {
            return res.status(400).json({ error: 'Nome e sobrenome válidos são obrigatórios para prosseguir.' });
        }

        const finalAmount = Number(amount) || 14.90;
        const uniqueTimestamp = new Date().getTime();

        const payerForPix = {
            email: email.trim(),
            entity_type: 'individual',
            identification: { type: 'CPF', number: cleanCpf }
        };

        const payerForCard = {
            email: email.trim(),
            entity_type: 'individual',
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            identification: { type: 'CPF', number: cleanCpf }
        };

        const payload = {
            transaction_amount: finalAmount,
            payment_method_id: payment_method_id,
            description: 'Plano MyFlowDay Premium',
            external_reference: external_reference || `order_${userId}_${uniqueTimestamp}`,
            statement_descriptor: 'MYFLOWDAY',
            payer: payment_method_id === 'pix' ? payerForPix : payerForCard,
            additional_info: {
                items: [{
                    id: 'premium-monthly',
                    title: 'Assinatura MyFlowDay Premium',
                    description: 'Acesso completo às ferramentas do MyFlowDay',
                    category_id: 'services',
                    quantity: 1,
                    unit_price: finalAmount
                }],
                payer: { first_name: first_name.trim(), last_name: last_name.trim() }
            },
            metadata: metadata || { user_id: userId, plan: 'premium' },
            notification_url: process.env.MP_WEBHOOK_URL || 'https://myflowday.com.br/api/webhook/mercadopago'
        };

        if (payment_method_id !== 'pix') {
            payload.token = token;
            const resolvedInstallments = Number(installments) || 1;
            if (!Number.isInteger(resolvedInstallments) || resolvedInstallments < 1 || resolvedInstallments > 12) {
                return res.status(400).json({ error: 'Invalid installments value' });
            }
            payload.installments = resolvedInstallments;
        }

        // LEGACY PAYMENT FLOW — usa MP_ACCESS_TOKEN (mesma convenção do novo fluxo)
        const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
        const mpPayment = new MPPayment(mpClient);

        console.log('[LEGACY MP Request]:', {
            payment_method: payment_method_id,
            amount: finalAmount,
            has_device_fingerprint: !!deviceId,
            payer_email_masked: email ? email.slice(0, 3) + '***' : 'VAZIO'
        });

        let paymentResult;
        try {
            paymentResult = await mpPayment.create({
                body: payload,
                requestOptions: {
                    idempotencyKey,
                    ...(deviceId && { customHeaders: { 'X-Meli-Session-Id': deviceId } })
                }
            });
        } catch (mpError) {
            const errData = mpError?.cause || mpError;
            console.error('[LEGACY Mercado Pago SDK Error]:', JSON.stringify(errData));
            return res.status(400).json({
                error: errData?.message || 'Falha no processamento no Mercado Pago.',
                status_detail: errData?.status_detail || null,
                details: errData
            });
        }

        const maskedResponse = {
            ...paymentResult,
            payer: paymentResult.payer ? {
                ...paymentResult.payer,
                email: maskEmail(paymentResult.payer.email),
                identification: paymentResult.payer.identification ? {
                    ...paymentResult.payer.identification,
                    number: maskCpf(paymentResult.payer.identification.number)
                } : undefined
            } : undefined
        };

        const paymentIdStr = String(paymentResult.id);
        const paymentStatusRaw = paymentResult.status;
        let paymentStatusNormalized = normalizeStatus(paymentStatusRaw);

        let isForcedPending = false;
        if (payment_method_id === 'pix' && paymentStatusNormalized === 'approved') {
            paymentStatusNormalized = 'pending';
            isForcedPending = true;
        }

        const { data: existingPayment } = await supabaseAdmin
            .from('payment_events')
            .select('status')
            .eq('payment_id', paymentIdStr)
            .maybeSingle();

        if (existingPayment && ['approved', 'rejected', 'cancelled', 'refunded', 'charged_back'].includes(existingPayment.status)) {
            return res.status(200).json({ success: true, alreadyProcessed: true, status: existingPayment.status });
        }

        await supabaseAdmin.from('payment_ledger').insert([{
            payment_id: paymentIdStr,
            event_type: 'payment_created',
            status_raw: 'created',
            status_normalized: 'created',
            user_id: userId,
            payload: maskedResponse
        }]);

        await supabaseAdmin.from('payment_events').upsert({
            payment_id: paymentIdStr,
            status: 'created',
            user_id: userId,
            plan: 'premium',
            processed_at: new Date().toISOString(),
            raw_payload: maskedResponse
        }, { onConflict: 'payment_id' });

        await supabaseAdmin.from('subscriptions').upsert({
            user_id: userId,
            status: 'past_due',
            plan: 'premium',
            last_payment_id: paymentIdStr,
            provider: 'mercado_pago',
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

        let currentStatus = 'created';

        if (paymentStatusNormalized !== 'created') {
            try {
                PaymentStateMachine.transition(currentStatus, paymentStatusNormalized);

                await supabaseAdmin.from('payment_events')
                    .update({ status: paymentStatusNormalized, processed_at: new Date().toISOString(), raw_payload: maskedResponse })
                    .eq('payment_id', paymentIdStr);

                currentStatus = paymentStatusNormalized;

                if (paymentStatusNormalized === 'approved' && !isForcedPending) {
                    const customerId = paymentResult.payer?.id || null;
                    await BillingEngine.handlePaymentApproved(userId, customerId, paymentIdStr, paymentResult);
                }
            } catch (transitionErr) {
                console.error(`[LEGACY] Transição de estado inválida: ${transitionErr.message}`);
            }
        }

        const transactionData = paymentResult.point_of_interaction?.transaction_data || {};

        if (payment_method_id === 'pix') {
            const statusDetail = paymentResult.status_detail || 'sem_detalhe';
            console.error(`[LEGACY Pix] status=${paymentStatusNormalized} status_detail=${statusDetail}`);

            if (paymentStatusNormalized === 'rejected' || paymentStatusNormalized === 'cancelled') {
                let userMessage = 'O Mercado Pago recusou a transação Pix.';
                if (statusDetail.includes('identification') || statusDetail.includes('cpf')) {
                    userMessage = 'CPF inválido ou não encontrado no Mercado Pago.';
                } else if (statusDetail.includes('high_risk') || statusDetail.includes('risk')) {
                    userMessage = 'Transação recusada por segurança. Tente novamente após alguns minutos.';
                } else if (statusDetail.includes('duplicated')) {
                    userMessage = 'Pagamento duplicado detectado.';
                }
                return res.status(400).json({
                    success: false,
                    status: paymentStatusNormalized,
                    status_detail: statusDetail,
                    error: userMessage
                });
            }

            if (!transactionData.qr_code && !transactionData.qr_code_base64) {
                return res.status(400).json({
                    status: 'rejected',
                    error: 'Mercado Pago não retornou os dados do QR Code.'
                });
            }

            return res.status(200).json({
                success: true,
                paymentMethod: 'pix',
                status: paymentStatusNormalized,
                qr_code: transactionData.qr_code || transactionData.ticket_url || null,
                qr_code_base64: transactionData.qr_code_base64 || null,
                id: paymentResult.id,
                point_of_interaction: paymentResult.point_of_interaction
            });
        }

        return res.status(200).json({ success: true, id: paymentResult.id, status: paymentStatusNormalized });

    } catch (error) {
        console.error('[LEGACY] Erro crítico ao processar pagamento:', error);
        return res.status(500).json({ error: 'Erro crítico interno ao processar pagamento.', message: error.message });
    }
}

// =========================================================
// HANDLER: handleSubscriptionSync (NOVO)
// POST /api/subscription/sync
// Reconcilia o status entre Mercado Pago e Supabase.
// Corrige webhooks perdidos, status presos em 'pending',
// e inconsistências após falhas de webhook.
//
// Acionado por: Vercel Cron Jobs (vercel.json) ou chamada manual.
// Proteção: header Authorization: Bearer <SYNC_SECRET_KEY>
//
// Modos de uso:
//   1. userId no body → sincroniza um usuário específico
//   2. body vazio → sincroniza todos com status 'pending'
// =========================================================

async function handleSubscriptionSync(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
    }

    // Autenticação obrigatória — protege contra acionamento externo não autorizado
    const authHeader = req.headers['authorization'] || '';
    const syncSecret = process.env.SYNC_SECRET_KEY || '';

    if (!syncSecret) {
        console.error('[SubscriptionSync] SYNC_SECRET_KEY não configurado no Vercel.');
        return res.status(500).json({ error: 'Sync não configurado.' });
    }

    if (authHeader !== `Bearer ${syncSecret}`) {
        console.warn('[SubscriptionSync] Acesso não autorizado.');
        return res.status(401).json({ error: 'Não autorizado.' });
    }

    const { userId } = req.body || {};
    const startedAt = new Date().toISOString();
    let cronRunId = null;

    // Registra início da execução em cron_runs
    try {
        const { data: cronRun } = await supabaseAdmin.from('cron_runs').insert([{
            job_name: 'subscription-sync',
            started_at: startedAt,
            status: 'running'
        }]).select('id').maybeSingle();
        cronRunId = cronRun?.id || null;
    } catch (_) { /* não bloqueia */ }

    try {
        let subscriptionsToSync = [];

        if (userId) {
            // Modo 1: sincronizar usuário específico
            const { data } = await supabaseAdmin
                .from('subscriptions')
                .select('user_id, mp_subscription_id, status')
                .eq('user_id', userId)
                .maybeSingle();
            if (data) subscriptionsToSync = [data];
        } else {
            // Modo 2: sincronizar todos com status 'pending' (webhook pode ter falhado)
            const { data } = await supabaseAdmin
                .from('subscriptions')
                .select('user_id, mp_subscription_id, status')
                .eq('status', 'pending')
                .not('mp_subscription_id', 'is', null)
                .limit(50); // processa até 50 por execução de cron
            subscriptionsToSync = data || [];
        }

        const results = [];
        let synced = 0;
        let skipped = 0;
        let errors = 0;

        for (const sub of subscriptionsToSync) {
            if (!sub.mp_subscription_id) { skipped++; continue; }

            try {
                // Busca status atual no Mercado Pago
                const mpRes = await fetch(
                    `https://api.mercadopago.com/preapproval/${sub.mp_subscription_id}`,
                    { headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` } }
                );

                if (!mpRes.ok) {
                    console.warn(`[SubscriptionSync] Falha ao buscar preapproval/${sub.mp_subscription_id}: ${mpRes.status}`);
                    errors++;
                    results.push({ user_id: sub.user_id, error: `mp_status_${mpRes.status}` });
                    continue;
                }

                const mpData = await mpRes.json();
                const mpStatus = normalizeSubscriptionStatus(mpData.status);

                if (mpStatus === sub.status) {
                    // Já sincronizado
                    skipped++;
                    results.push({ user_id: sub.user_id, action: 'noop', status: sub.status });
                    continue;
                }

                console.log(`[SubscriptionSync] Divergencia: userId=${sub.user_id} | supabase=${sub.status} | mp=${mpStatus}`);

                // Aplica o status correto via engine
                if (mpStatus === 'authorized') {
                    await SubscriptionBillingEngine.handleAuthorized(sub.user_id, sub.mp_subscription_id, mpData);
                } else if (mpStatus === 'paused') {
                    await SubscriptionBillingEngine.handlePaused(sub.user_id, sub.mp_subscription_id, mpData);
                } else if (mpStatus === 'cancelled') {
                    await SubscriptionBillingEngine.handleCancelled(sub.user_id, sub.mp_subscription_id, mpData);
                } else if (mpStatus === 'expired') {
                    await SubscriptionBillingEngine.handleExpired(sub.user_id, sub.mp_subscription_id, mpData);
                } else {
                    // payment_required ou status desconhecido
                    await supabaseAdmin.from('subscriptions').update({
                        status: mpStatus,
                        last_webhook_at: new Date().toISOString()
                    }).eq('user_id', sub.user_id);
                    await SubscriptionBillingEngine.logEvent(
                        sub.mp_subscription_id,
                        `sync.status_updated.${mpStatus}`,
                        { user_id: sub.user_id, previous: sub.status, current: mpStatus }
                    );
                }

                synced++;
                results.push({ user_id: sub.user_id, action: 'synced', from: sub.status, to: mpStatus });

            } catch (subErr) {
                console.error(`[SubscriptionSync] Erro ao sincronizar userId=${sub.user_id}:`, subErr.message);
                errors++;
                results.push({ user_id: sub.user_id, error: subErr.message });
            }
        }

        const summary = { total: subscriptionsToSync.length, synced, skipped, errors };
        console.log('[SubscriptionSync] Concluído:', summary);

        // Atualiza cron_runs com resultado
        if (cronRunId) {
            await supabaseAdmin.from('cron_runs').update({
                finished_at: new Date().toISOString(),
                status: errors > 0 ? 'partial' : 'success',
                result: { summary, results }
            }).eq('id', cronRunId).catch(() => {});
        }

        return res.status(200).json({ success: true, ...summary, results });

    } catch (err) {
        console.error('[SubscriptionSync] Erro crítico:', err);

        if (cronRunId) {
            await supabaseAdmin.from('cron_runs').update({
                finished_at: new Date().toISOString(),
                status: 'error',
                result: { error: err.message }
            }).eq('id', cronRunId).catch(() => {});
        }

        return res.status(500).json({ error: 'Erro ao executar sincronização.', message: err.message });
    }
}

// =========================================================
// HANDLER: handleAccessCheck
// =========================================================

async function handleAccessCheck(req, res) {
    res.status(200).json({ status: 'free', isPro: false });
}

// =========================================================
// ROUTER PRINCIPAL
// =========================================================

export default async function handler(req, res) {
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,PUT,PATCH,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Idempotency-Key, X-Trace-Id');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const route = Array.isArray(req.query.routes)
        ? req.query.routes.join('/')
        : (req.query.routes || '');

    // 🔒 Bloqueia acesso a rotas sensíveis
    const blockedPatterns = ['.env', '.git', 'config', 'secrets', 'credentials'];
    if (blockedPatterns.some(p => route.toLowerCase().includes(p))) {
        console.warn(`[Security] Acesso bloqueado: ${route} | IP: ${req.headers['x-forwarded-for'] || 'desconhecido'}`);
        return res.status(403).json({ error: 'Acesso negado.' });
    }

    try {
        // ── NOVAS ROTAS DE ASSINATURA ──────────────────────────────────────
        if (route === 'subscription/create') {
            await handleSubscriptionCreate(req, res);

        } else if (route === 'subscription/status') {
            await handleSubscriptionStatus(req, res);

        // ── SYNC / RECONCILIAÇÃO (Vercel Cron + manual) ─────────────────
        } else if (route === 'subscription/sync') {
            await handleSubscriptionSync(req, res);

        // ── WEBHOOK (preapproval + payment) ───────────────────────────────
        } else if (route === 'webhooks/mercadopago' || route === 'webhook/mercadopago') {
            await handleWebhookMercadoPago(req, res);

        // ── ACESSO ────────────────────────────────────────────────────────
        } else if (route === 'access/check' || route === 'auth/check-access') {
            await handleAccessCheck(req, res);

        // ── LEGACY PAYMENT FLOW ───────────────────────────────────────────
        } else if (route === 'payments/create') {
            // LEGACY PAYMENT FLOW — mantido para compatibilidade
            await handlePaymentsCreate(req, res, route);

        // ── HEALTH CHECK ──────────────────────────────────────────────────
        } else if (route === '' || route === 'health') {
            res.status(200).json({ status: 'online', ts: new Date().toISOString() });

        } else {
            console.warn(`[Router] Rota não encontrada: ${route}`);
            res.status(404).json({ error: `Rota não encontrada: ${route}` });
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro interno.', message: error.message });
    }
}