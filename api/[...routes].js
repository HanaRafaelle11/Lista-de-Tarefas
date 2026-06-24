import crypto from 'crypto';
import fetch from 'node-fetch'; // ou use o fetch nativo se seu Node for v18+
// Adicione aqui os seus imports originais do Supabase, Logger e Engines do projeto, ex:
// import { supabaseAdmin } from '../lib/supabase'; 
// import { BillingLogger, BillingTracer, IdempotencyManager, PaymentStateMachine, BillingEngine, RetryEngine, ChaosEngine, EventOrderingEngine, DistributedLock } from '../lib/billing';

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
// HANDLERS INDIVIDUAIS CONSOLIDADOS (O Código que o Gemini gerou)
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
            const statusCode = mpResponse.status;
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
            } catch (transitionErr) {
                console.error(`[Unified API: ${routePath}] Transição de estado inválida ao criar: ${transitionErr.message}`);
            }
        }

        const transactionData = paymentResult.point_of_interaction?.transaction_data || {};
        const qr_code = transactionData.qr_code || transactionData.ticket_url || null;
        const qr_code_base64 = transactionData.qr_code_base64 || null;

        const richResponse = {
            id: paymentResult.id,
            status: paymentStatusNormalized,
            status_detail: paymentResult.status_detail,
            transaction_amount: paymentResult.transaction_amount,
            payment_method_id: paymentResult.payment_method_id,
            point_of_interaction: paymentResult.point_of_interaction,
            payer: paymentResult.payer,
            date_created: paymentResult.date_created,
            date_approved: paymentResult.date_approved
        };

        if (payment_method_id === 'pix') {
            return res.status(200).json({
                success: true,
                paymentMethod: 'pix',
                status: paymentStatusNormalized,
                qr_code,
                qr_code_base64,
                ...richResponse
            });
        }

        return res.status(200).json({ success: true, ...richResponse });
    } catch (error) {
        console.error(`[Unified API: ${routePath}] Erro crítico ao processar pagamento:`, error);
        return res.status(500).json({ error: 'Erro crítico interno ao processar pagamento.', message: error.message });
    }
}

async function handleSendPush(req, res, routePath) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
    }
    const { userId, title, body, url } = req.body || {};
    if (!userId || !title || !body) {
        return res.status(400).json({ error: 'Os campos userId, title e body são obrigatórios.' });
    }
    try {
        await sendPushNotification(userId, title, body, url || '/');
        return res.status(200).json({ success: true, message: 'Notificação enviada com sucesso!' });
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao enviar notificação.', message: error.message });
    }
}

async function handleWebhookMercadoPago(req, res, routePath) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
    }

    const requestTraceId = req.headers['x-trace-id'] || crypto.randomUUID();
    const idempotencyKey = req.headers['x-idempotency-key'] || req.headers['X-Idempotency-Key'] || null;

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
        // Aqui continuaria a lógica interna do seu webhook conforme mapeado pelo Gemini...
        return res.status(200).json({ success: true, paymentId: paymentIdStr });
    });
}

// Outros stubs de handlers mapeados no switch/case global (Exemplos)
async function handleAccessCheck(req, res, path) { res.status(200).json({ msg: "Access Check OK" }); }
async function handleRevenueIntegrity(req, res, path) { res.status(200).json({ msg: "Revenue Integrity OK" }); }
async function handleRevenue(req, res, path) { res.status(200).json({ msg: "Revenue OK" }); }
async function handleUserTimeline(req, res, path) { res.status(200).json({ msg: "Timeline OK" }); }
async function handleBillingReactivate(req, res, path) { res.status(200).json({ msg: "Reactivate OK" }); }
async function handleBillingReconcile(req, res, path) { res.status(200).json({ msg: "Reconcile OK" }); }
async function handleCheckout(req, res, path) { res.status(200).json({ msg: "Checkout OK" }); }
async function handleDebugEvents(req, res, path) { res.status(200).json({ msg: "Debug OK" }); }
async function handleDevSimulatePayment(req, res, path) { res.status(200).json({ msg: "Simulation OK" }); }

// =========================================================
// PONTO DE ENTRADA CENTRAL DA VERCEL (ROTEADOR DINÂMICO)
// =========================================================
export default async function handler(req, res) {
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,PUT,PATCH,DELETE');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Trace-Id, X-Idempotency-Key'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const route = req.query.routes.join('/');

    try {
        switch (route) {
            case 'access/check':
            case 'auth/check-access':
                await handleAccessCheck(req, res, route);
                break;
            case 'analytics/revenue-integrity':
                await handleRevenueIntegrity(req, res, route);
                break;
            case 'analytics/revenue':
                await handleRevenue(req, res, route);
                break;
            case 'analytics/user-timeline':
                await handleUserTimeline(req, res, route);
                break;
            case 'billing/reactivate':
                await handleBillingReactivate(req, res, route);
                break;
            case 'billing/reconcile':
                await handleBillingReconcile(req, res, route);
                break;
            case 'checkout':
                await handleCheckout(req, res, route);
                break;
            case 'debug/events':
                await handleDebugEvents(req, res, route);
                break;
            case 'dev/simulate-payment':
                await handleDevSimulatePayment(req, res, route);
                break;
            case 'payments/create':
                await handlePaymentsCreate(req, res, route);
                break;
            case 'send-push':
                await handleSendPush(req, res, route);
                break;
            case 'webhook/mercadopago':
                await handleWebhookMercadoPago(req, res, route);
                break;
            default:
                res.status(404).json({ error: 'Endpoint não encontrado.' });
                break;
        }
    } catch (error) {
        console.error(`[Unified API: Global Error for route ${route}]`, error);
        res.status(500).json({ error: 'Erro interno do servidor.', message: error.message });
    }
}