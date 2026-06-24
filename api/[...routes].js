import crypto from 'crypto';
import fetch from 'node-fetch';

// Importação segura do cliente Supabase local
import { supabaseAdmin } from '../lib/supabase.js';
import { PaymentStateMachine } from './payment-state-machine.js';
import { BillingEngine } from './billing-engine.js';

// Dublês (Stubs) de monitorização e resiliência para compatibilidade
const BillingTracer = {
    runWithTrace: async (id, fn) => await fn(),
    recordTrace: async () => { }
};
const BillingLogger = {
    info: (msg, id, extra, obj) => console.log(`[BillingInfo: ${msg}]`, obj || ''),
    warn: (msg, id, extra, obj) => console.warn(`[BillingWarn: ${msg}]`, obj || ''),
    error: (msg, id, extra, err, obj) => console.error(`[BillingError: ${msg}]`, err, obj || '')
};

// Funções auxiliares de segurança e mascaramento
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
// HANDLERS DE ROTA CONSOLIDADOS
// =========================================================

async function handlePaymentsCreate(req, res, routePath) {
    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
        }

        const { userId, email, amount, payment_method_id, token, installments, cpf } = req.body || {};
        const idempotencyKey = req.headers['x-idempotency-key'] || crypto.randomUUID();

        if (!userId || !email || !payment_method_id) {
            return res.status(400).json({ error: 'Campos obrigatórios em falta.' });
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
            console.warn(`[Unified API: ${routePath}] Falha ao procurar perfil em payments create:`, err.message);
        }

        if (!first_name || !last_name || isGenericName(first_name) || isGenericName(last_name)) {
            return res.status(400).json({ error: 'Nome e sobrenome válidos são obrigatórios para prosseguir.' });
        }

        // Payload limpo para Mercado Pago Bricks
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
            if (!Number.isInteger(resolvedInstallments) || resolvedInstallments < 1 || resolvedInstallments > 12) {
                return res.status(400).json({ error: 'Invalid installments value' });
            }
            payload.installments = resolvedInstallments;
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
            return res.status(400).json({ error: 'Falha no processamento no Mercado Pago.', details: errData });
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
        let paymentStatusNormalized = normalizeStatus(paymentStatusRaw);

        // 🛡️ BLINDAGEM ANTI-SANDBOX (O Segredo do QR Code) 🛡️
        // Força o sistema a não aprovar o Pix instantaneamente na criação,
        // garantindo que o Webhook seja a única forma de liberar a assinatura.
        let isForcedPending = false;
        if (payment_method_id === 'pix' && paymentStatusNormalized === 'approved') {
            console.warn(`[Anti-Bug Pix] Mercado Pago aprovou instantaneamente. Forçando pendência para o Webhook atuar.`);
            paymentStatusNormalized = 'pending';
            isForcedPending = true;
        }

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

                // Só ativa o BillingEngine se for aprovado E não for um Pix forçado para pending
                if (paymentStatusNormalized === 'approved' && !isForcedPending) {
                    const customerId = paymentResult.payer?.id || null;
                    await BillingEngine.handlePaymentApproved(userId, customerId, paymentIdStr, paymentResult);
                }
            } catch (transitionErr) {
                console.error(`[Unified API: ${routePath}] Transição de estado inválida ao criar: ${transitionErr.message}`);
            }
        }

        const transactionData = paymentResult.point_of_interaction?.transaction_data || {};

        if (payment_method_id === 'pix') {
            // Trava final: Se não houver QR Code, dispara um erro em vez de seguir
            if (!transactionData.qr_code && !transactionData.qr_code_base64) {
                return res.status(400).json({
                    status: 'rejected',
                    error: 'Mercado Pago não retornou os dados do QR Code. Tente com outro CPF.'
                });
            }

            return res.status(200).json({
                success: true,
                paymentMethod: 'pix',
                status: paymentStatusNormalized, // Sempre será 'pending' agora
                qr_code: transactionData.qr_code || transactionData.ticket_url || null,
                qr_code_base64: transactionData.qr_code_base64 || null,
                id: paymentResult.id,
                point_of_interaction: paymentResult.point_of_interaction
            });
        }

        return res.status(200).json({ success: true, id: paymentResult.id, status: paymentStatusNormalized });
    } catch (error) {
        console.error(`[Unified API: ${routePath}] Erro crítico ao processar pagamento:`, error);
        return res.status(500).json({ error: 'Erro crítico interno ao processar pagamento.', message: error.message });
    }
}

async function handleWebhookMercadoPago(req, res, routePath) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
    }

    const requestTraceId = req.headers['x-trace-id'] || crypto.randomUUID();

    return await BillingTracer.runWithTrace(requestTraceId, async () => {
        let paymentId = null;
        let topic = null;

        if (req.body && req.body.type === 'payment') {
            paymentId = req.body.data && req.body.data.id;
            topic = 'payment';
        } else if (req.body && req.body.topic === 'payment') {
            paymentId = req.body.id;
            topic = 'payment';
        }

        if (topic !== 'payment' || !paymentId) {
            return res.status(200).json({ message: 'Evento recebido, mas não processado.' });
        }

        const paymentIdStr = String(paymentId);

        try {
            const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentIdStr}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!mpResponse.ok) {
                return res.status(400).json({ error: 'Falha ao buscar detalhes do pagamento no Mercado Pago.' });
            }

            const paymentDetails = await mpResponse.json();
            const userId = paymentDetails.metadata && paymentDetails.metadata.user_id;

            if (userId && normalizeStatus(paymentDetails.status) === 'approved') {
                const customerId = paymentDetails.payer && paymentDetails.payer.id;
                await BillingEngine.handlePaymentApproved(userId, customerId, paymentIdStr, paymentDetails);
            }

            return res.status(200).json({ success: true, paymentId: paymentIdStr });
        } catch (webhookErr) {
            console.error(`[Webhook Error]`, webhookErr);
            return res.status(500).json({ error: 'Erro ao processar o webhook.' });
        }
    });
}

async function handleAccessCheck(req, res) {
    res.status(200).json({ status: "free", isPro: false });
}

// =========================================================
// PONTO DE ENTRADA CENTRAL (VERCEL ROUTER)
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

    const route = Array.isArray(req.query.routes) ? req.query.routes.join('/') : (req.query.routes || '');

    try {
        if (route === 'payments/create') {
            await handlePaymentsCreate(req, res, route);
        } else if (route === 'access/check' || route === 'auth/check-access') {
            await handleAccessCheck(req, res);
        } else if (route === 'webhook/mercadopago') {
            await handleWebhookMercadoPago(req, res, route);
        } else {
            res.status(200).json({ status: "online", msg: "Roteador central ativo" });
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro interno.', message: error.message });
    }
}