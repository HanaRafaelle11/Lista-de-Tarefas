import crypto from 'crypto';
import fetch from 'node-fetch';

// Importações reais do seu projeto
import { supabaseAdmin } from '../lib/supabase.js';
import { PaymentStateMachine } from './payment-state-machine.js';
import { BillingEngine } from './billing-engine.js'; // Como você moveu tudo para a pasta api, ele lê do mesmo diretório

// Dublês (Stubs) de telemetria para evitar erros de variáveis não definidas no webhook
const BillingTracer = {
    runWithTrace: async (id, fn) => await fn(),
    recordTrace: async () => { }
};
const BillingLogger = {
    info: (msg, id, extra, obj) => console.log(`[BillingInfo: ${msg}]`, obj || ''),
    warn: (msg, id, extra, obj) => console.warn(`[BillingWarn: ${msg}]`, obj || ''),
    error: (msg, id, extra, err, obj) => console.error(`[BillingError: ${msg}]`, err, obj || '')
};
const IdempotencyManager = {
    startProcessing: async (id, step, key) => ({ success: true, duplicate: false }),
    complete: async (id, step, result) => { },
    fail: async (id, step) => { }
};
const ChaosEngine = {
    applyDelayIfEnabled: async () => { },
    triggerFailureIfEnabled: async () => { }
};
const RetryEngine = {
    execute: async (fn) => await fn()
};
const DistributedLock = {
    withLock: async (key, fn) => await fn()
};
const EventOrderingEngine = {
    isEventOutOfOrder: async () => false
};
const sendPushNotification = async (userId, title, body, url) => {
    console.log(`[Push Stub] Enviando para ${userId}: ${title} - ${body}`);
};

// Funções auxiliares de segurança mantidas da sua arquitetura original
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
// HANDLERS INDIVIDUAIS CONSOLIDADOS
// =========================================================

async function handlePaymentsCreate(req, res, routePath) {
    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
        }

        const { userId, email, amount, payment_method_id, token, installments, cpf } = req.body || {};
        const idempotencyKey = req.headers['x-idempotency-key'] || crypto.randomUUID();

        if (!userId || !email || !payment_method_id) {
            return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
        }

        const cleanCpf = cpf ? cpf.replace(/\D/g, '') : '';
        let first_name = '', last_name = '';

        try {
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('name, nickname')
                .eq('id', userId)
                .maybeSingle();

            const fullName = profile?.name || profile?.nickname;
            if (fullName) {
                const parts = fullName.trim().split(/\s+/);
                first_name = parts[0] || '';
                last_name = parts.slice(1).join(' ') || '';
            }
        } catch (err) {
            console.warn(`[Unified API: ${routePath}] Falha ao buscar perfil em payments create:`, err.message);
        }

        if (!first_name || !last_name || isGenericName(first_name) || isGenericName(last_name)) {
            return res.status(400).json({ error: 'Nome e sobrenome válidos são obrigatórios para prosseguir.' });
        }

        const payload = {
            transaction_amount: Number(amount) || 14.90,
            payment_method_id,
            description: "MyFlowDay Premium",
            external_reference: userId,
            statement_descriptor: "MYFLOWDAY",
            payer: {
                email: email.trim(),
                first_name: first_name.trim(),
                last_name: last_name.trim(),
                entity_type: "individual",
                type: "customer",
                identification: {
                    type: "CPF",
                    number: cleanCpf
                }
            },
            metadata: {
                user_id: userId,
                cpf: cleanCpf,
                email: email.trim(),
                plan: "premium"
            },
            notification_url: process.env.MERCADOPAGO_WEBHOOK_URL || "https://myflowday.com.br/api/webhook/mercadopago"
        };

        if (payment_method_id !== 'pix') {
            payload.token = token;
            const resolvedInstallments = Number(installments) || 1;
            console.log(`[Unified API: ${routePath}] Installments recebidos:`, resolvedInstallments);

            if (!Number.isInteger(resolvedInstallments) || resolvedInstallments < 1 || resolvedInstallments > 12) {
                return res.status(400).json({ error: 'Invalid installments value' });
            }
            payload.installments = resolvedInstallments;
        }

        const isProd = process.env.NODE_ENV === 'production';
        if (!isProd) {
            console.log(`[Unified API: ${routePath}] 📦 MP PAYLOAD FINAL:`, JSON.stringify(payload, null, 2));
        } else {
            const securePayload = {
                ...payload,
                payer: payload.payer ? {
                    ...payload.payer,
                    email: maskEmail(payload.payer.email),
                    identification: payload.payer.identification ? {
                        ...payload.payer.identification,
                        number: maskCpf(payload.payer.identification.number)
                    } : undefined
                } : undefined,
                metadata: payload.metadata ? {
                    ...payload.metadata,
                    email: maskEmail(payload.metadata.email),
                    cpf: maskCpf(payload.metadata.cpf)
                } : undefined
            };
            console.log(`[Unified API: ${routePath}] 📦 MP PAYLOAD FINAL:`, JSON.stringify(securePayload, null, 2));
        }

        const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': idempotencyKey
            },
            body: JSON.stringify(payload)
        });

        if (!mpResponse.ok) {
            const errData = await mpResponse.json().catch(() => ({}));
            console.error(`[Unified API: ${routePath}] Erro ao criar pagamento no MP`);
            return res.status(400).json({ error: 'Falha no processamento do pagamento no Mercado Pago.', details: errData });
        }

        const paymentResult = await mpResponse.json();
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
        const paymentStatusNormalized = normalizeStatus(paymentStatusRaw);

        const { data: existingPayment } = await supabaseAdmin
            .from('payment_events')
            .select('status')
            .eq('payment_id', paymentIdStr)
            .maybeSingle();

        if (existingPayment && ['approved', 'rejected', 'cancelled', 'refunded', 'reconciled'].includes(existingPayment.status)) {
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
                    .update({
                        status: paymentStatusNormalized,
                        processed_at: new Date().toISOString(),
                        raw_payload: maskedResponse
                    })
                    .eq('payment_id', paymentIdStr);

                currentStatus = paymentStatusNormalized;

                if (paymentStatusNormalized === 'approved') {
                    const customerId = paymentResult.payer?.id || null;
                    await BillingEngine.handlePaymentApproved(userId, customerId, paymentIdStr, paymentResult);
                }
            } catch (transitionErr