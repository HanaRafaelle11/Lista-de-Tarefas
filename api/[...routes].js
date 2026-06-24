import crypto from 'crypto';
import fetch from 'node-fetch';

// Importação segura do cliente Supabase local
import { supabaseAdmin } from '../lib/supabase.js';

// =========================================================
// MÁQUINA DE ESTADOS INLINE (Evita quebra no Rolldown/Vite)
// =========================================================
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

// Engine de faturamento simplificada inline para garantir o deploy estável
const BillingEngine = {
    async handlePaymentApproved(userId, customerId, paymentIdStr, paymentResult) {
        if (!userId) return;
        const now = new Date();
        const d = new Date();
        d.setDate(d.getDate() + 30);
        const expiresAt = d.toISOString();

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

        await supabaseAdmin.from('profiles').update({
            plano: 'premium',
            assinatura_status: 'active',
            assinatura_inicio: now.toISOString(),
            assinatura_expira_em: expiresAt,
            mercadopago_customer_id: customerId || null,
            updated_at: now.toISOString()
        }).eq('id', userId);

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

// Dublês (Stubs) de monitorização e resiliência
const BillingTracer = {
    runWithTrace: async (id, fn) => await fn(),
    recordTrace: async () => { }
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

        // 🛡️ CAPTURADO: Dados limpos vindo do payload unificado do frontend
        const { userId, email, amount, payment_method_id, token, installments, cpf, deviceId, external_reference, metadata } = req.body || {};
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
            console.warn(`[Unified API] Falha ao procurar perfil:`, err.message);
        }

        if (!first_name || !last_name || isGenericName(first_name) || isGenericName(last_name)) {
            return res.status(400).json({ error: 'Nome e sobrenome válidos são obrigatórios para prosseguir.' });
        }

        const finalAmount = Number(amount) || 14.90;
        const uniqueTimestamp = new Date().getTime();

        // 🛡️ CORRIGIDO: Payload dinâmico que respeita a referência única e o mapeamento de cartão
        const payload = {
            transaction_amount: finalAmount,
            payment_method_id: payment_method_id, // Recebe dinamicamente a bandeira do cartão ou 'pix'
            description: "Plano MyFlowDay Premium",
            external_reference: external_reference || `order_${userId}_${uniqueTimestamp}`, // Único por tentativa
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
            additional_info: {
                items: [
                    {
                        id: "premium-monthly",
                        title: "Assinatura MyFlowDay Premium",
                        description: "Acesso completo às ferramentas do MyFlowDay",
                        category_id: "services",
                        quantity: 1,
                        unit_price: finalAmount
                    }
                ]
            },
            metadata: metadata || {
                user_id: userId,
                plan: "premium" // Removido dados PII duplicados por segurança
            },
            notification_url: process.env.MERCADOPAGO_WEBHOOK_URL || "https://myflowday.com.br/api/webhook/mercadopago"
        };

        // Injeta os campos necessários caso o fluxo seja cartão de crédito
        if (payment_method_id !== 'pix') {
            payload.token = token;
            const resolvedInstallments = Number(installments) || 1;
            if (!Number.isInteger(resolvedInstallments) || resolvedInstallments < 1 || resolvedInstallments > 12) {
                return res.status(400).json({ error: 'Invalid installments value' });
            }
            payload.installments = resolvedInstallments;
        }

        // 🛡️ CORRIGIDO: Mapeamento oficial com o header X-Meli-Session-Id exigido pelo antifraude
        const headers = {
            'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': idempotencyKey,
            'X-Developer-Id': '5944910093081420'
        };

        if (deviceId) {
            headers['X-Meli-Session-Id'] = deviceId; // Nome padrão oficial do Mercado Pago corrigido
        }

        const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        if (!mpResponse.ok) {
            const errData = await mpResponse.json().catch(() => ({}));
            console.error('[Mercado Pago API Error Details]:', JSON.stringify(errData));
            return res.status(400).json({
                error: 'Falha no processamento no Mercado Pago.',
                details: errData?.cause || errData?.message || errData
            });
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

        // 🛡️ BLINDAGEM ANTI-SANDBOX
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
                    .update({
                        status: paymentStatusNormalized,
                        processed_at: new Date().toISOString(),
                        raw_payload: maskedResponse
                    })
                    .eq('payment_id', paymentIdStr);

                currentStatus = paymentStatusNormalized;

                if (paymentStatusNormalized === 'approved' && !isForcedPending) {
                    const customerId = paymentResult.payer?.id || null;
                    await BillingEngine.handlePaymentApproved(userId, customerId, paymentIdStr, paymentResult);
                }
            } catch (transitionErr) {
                console.error(`[Unified API] Transição de estado inválida: ${transitionErr.message}`);
            }
        }

        const transactionData = paymentResult.point_of_interaction?.transaction_data || {};

        if (payment_method_id === 'pix') {
            if (paymentStatusNormalized === 'rejected' || paymentStatusNormalized === 'cancelled') {
                return res.status(400).json({
                    success: false,
                    status: paymentStatusNormalized,
                    error: 'O Mercado Pago recusou a transação. Verifique se os dados de identificação e o sobrenome estão preenchidos de forma simples.'
                });
            }

            if (!transactionData.qr_code && !transactionData.qr_code_base64) {
                return res.status(400).json({
                    status: 'rejected',
                    error: 'Mercado Pago não retornou os dados do QR Code. Tente com outro CPF.'
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
        console.error(`[Unified API] Erro crítico ao processar pagamento:`, error);
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