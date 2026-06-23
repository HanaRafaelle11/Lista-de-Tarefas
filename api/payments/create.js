import { supabaseAdmin } from '../../lib/supabase.js';
import crypto from 'crypto';
import { PaymentStateMachine } from '../../services/payment-state-machine.js';
import { BillingEngine } from '../../services/billing-engine.js';

const MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;

if (!MERCADOPAGO_ACCESS_TOKEN) {
  throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");
}

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

function isGenericName(name) {
  if (!name) return true;
  const lower = name.toLowerCase().trim();
  return lower === 'usuario' || lower === 'flowday' || lower === 'usuario flowday' || lower === 'usuarioflowday' || lower === '' || lower === 'null' || lower === 'undefined';
}

function maskCpf(cpf) {
  if (!cpf) return '';
  return '***.***.***-**';
}

function maskEmail(email) {
  if (!email) return '';
  const parts = email.split('@');
  if (parts.length !== 2) return '***@domain.com';
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 2) {
    return `${name}***@${domain}`;
  }
  return `${name.slice(0, 2)}***@${domain}`;
}

function normalizeStatus(mpStatus) {
  const mapping = {
    approved: 'approved',
    pending: 'pending',
    in_process: 'in_process',
    authorized: 'approved',
    in_mediation: 'pending_review',
    rejected: 'rejected',
    cancelled: 'cancelled',
    refunded: 'refunded',
    charged_back: 'refunded'
  };
  return mapping[mpStatus] || mpStatus || 'pending';
}

export default async function handler(req, res) {
  // CORS configuration
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  const { token, payment_method_id, amount, userId, cpf, installments } = req.body || {};

  if (!userId) {
    res.status(400).json({ error: 'userId é obrigatório.' });
    return;
  }

  if (!payment_method_id) {
    res.status(400).json({ error: 'payment_method_id é obrigatório.' });
    return;
  }

  // Token is required only if it is NOT Pix
  if (payment_method_id !== 'pix' && !token) {
    res.status(400).json({ error: 'token é obrigatório para pagamentos com cartão.' });
    return;
  }

  // Retrieve email from Auth admin service
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (authError || !authData?.user) {
    res.status(400).json({ error: 'Usuário não autenticado ou inválido.' });
    return;
  }
  const email = authData.user.email;
  if (!email || email.trim() === '' || email === 'test_user@test.com' || email.toLowerCase() === 'null' || email.toLowerCase() === 'undefined') {
    res.status(400).json({ error: 'Email obrigatório.' });
    return;
  }

  // Retrieve CPF
  const cpfValue = cpf;
  if (!cpfValue) {
    res.status(400).json({ error: 'CPF é obrigatório.' });
    return;
  }

  const cleanCpf = cpfValue.replace(/\D/g, '');
  if (cleanCpf.length !== 11) {
    res.status(400).json({ error: 'CPF deve conter exatamente 11 dígitos.' });
    return;
  }

  if (!validateCpf(cleanCpf)) {
    res.status(400).json({ error: 'CPF inválido.' });
    return;
  }

  try {
    const idempotencyKey = crypto.randomUUID();

    // Fetch profile to get name/nickname for parsing first/last name
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('name, nickname')
      .eq('id', userId)
      .maybeSingle();

    let first_name = '';
    let last_name = '';

    const fullName = profile?.name || profile?.nickname;
    if (fullName) {
      const parts = fullName.trim().split(/\s+/);
      first_name = parts[0] || '';
      last_name = parts.slice(1).join(' ') || '';
    }

    // Validação estrita de nome - proibir campos genéricos e vazios
    if (!first_name || !last_name || isGenericName(first_name) || isGenericName(last_name)) {
      res.status(400).json({ error: 'Nome e sobrenome válidos são obrigatórios para prosseguir.' });
      return;
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
      notification_url: "https://myflowday.com.br/api/webhook/mercadopago"
    };

    if (payment_method_id !== 'pix') {
      payload.token = token;

      const resolvedInstallments = Number(installments) || 1;
      console.log("[MP] installments received:", resolvedInstallments);

      if (!Number.isInteger(resolvedInstallments) || resolvedInstallments < 1 || resolvedInstallments > 12) {
        res.status(400).json({ error: 'Invalid installments value' });
        return;
      }

      payload.installments = resolvedInstallments;
    }

    const loggedPayload = {
      ...payload,
      payer: {
        ...payload.payer,
        email: maskEmail(payload.payer?.email),
        identification: {
          ...payload.payer?.identification,
          number: maskCpf(payload.payer?.identification?.number)
        }
      }
    };
    if (loggedPayload.token) {
      loggedPayload.token = '***';
    }

    const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV || process.env.NODE_ENV === 'test';
    if (isDev) {
      console.log("📦 MP PAYLOAD FINAL:", JSON.stringify(payload, null, 2));
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
      console.log("📦 MP PAYLOAD FINAL:", JSON.stringify(securePayload, null, 2));
    }

    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(payload)
    });

    if (!mpResponse.ok) {
      const errData = await mpResponse.json().catch(() => ({}));
      console.error('[MP] Erro ao criar pagamento');
      console.error(JSON.stringify(errData, null, 2));
      if (isDev) {
        console.log("🚨 MP ERROR FULL:", JSON.stringify(errData, null, 2));
      } else {
        const secureErrData = JSON.parse(JSON.stringify(errData));
        if (secureErrData.payer) {
          if (secureErrData.payer.email) secureErrData.payer.email = maskEmail(secureErrData.payer.email);
          if (secureErrData.payer.identification && secureErrData.payer.identification.number) {
            secureErrData.payer.identification.number = maskCpf(secureErrData.payer.identification.number);
          }
        }
        console.log("🚨 MP ERROR FULL:", JSON.stringify(secureErrData, null, 2));
      }
      res.status(400).json({ error: 'Falha no processamento do pagamento no Mercado Pago.', details: errData });
      return;
    }

    const paymentResult = await mpResponse.json();
    if (isDev) {
      console.log("💥 MP RESPONSE FULL:", JSON.stringify(paymentResult, null, 2));
    } else {
      const secureResult = JSON.parse(JSON.stringify(paymentResult));
      if (secureResult.payer) {
        if (secureResult.payer.email) secureResult.payer.email = maskEmail(secureResult.payer.email);
        if (secureResult.payer.identification && secureResult.payer.identification.number) {
          secureResult.payer.identification.number = maskCpf(secureResult.payer.identification.number);
        }
      }
      console.log("💥 MP RESPONSE FULL:", JSON.stringify(secureResult, null, 2));
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
    console.log("[MP] Response", JSON.stringify(maskedResponse, null, 2));

    const paymentIdStr = String(paymentResult.id);
    const paymentStatusRaw = paymentResult.status;
    const paymentStatusNormalized = normalizeStatus(paymentStatusRaw);
    console.log("[MP] Status final retornado (raw):", paymentStatusRaw);
    console.log("[MP] Status final retornado (normalized):", paymentStatusNormalized);

    // Global Idempotency Check: Verify if already processed in payment_events
    const { data: existingPayment } = await supabaseAdmin
      .from('payment_events')
      .select('status')
      .eq('payment_id', paymentIdStr)
      .maybeSingle();

    if (existingPayment && ['approved', 'rejected', 'cancelled', 'refunded', 'reconciled'].includes(existingPayment.status)) {
      console.log(`[API Payment] Pagamento ${paymentIdStr} já processado anteriormente com status terminal: ${existingPayment.status}. Encerrando.`);
      return res.status(200).json({ success: true, alreadyProcessed: true, status: existingPayment.status });
    }

    // Criar evento inicial no ledger: payment_created (created)
    await supabaseAdmin.from('payment_ledger').insert([{
      payment_id: paymentIdStr,
      event_type: 'payment_created',
      status_raw: 'created',
      status_normalized: 'created',
      user_id: userId,
      payload: maskedResponse
    }]);

    // Gravar estado inicial na tabela de estado: created
    await supabaseAdmin.from('payment_events').upsert({
      payment_id: paymentIdStr,
      status: 'created',
      user_id: userId,
      plan: 'premium',
      processed_at: new Date().toISOString(),
      raw_payload: maskedResponse
    }, { onConflict: 'payment_id' });

    // Inicializar/atualizar registro de assinatura
    await supabaseAdmin.from('subscriptions').upsert({
      user_id: userId,
      status: 'past_due',
      plan: 'premium',
      last_payment_id: paymentIdStr,
      provider: 'mercado_pago',
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    let currentStatus = 'created';

    // Transicionar para o status retornado pelo Mercado Pago usando a State Machine
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

        await supabaseAdmin.from('payment_ledger').insert([{
          payment_id: paymentIdStr,
          event_type: 'status_updated',
          status_raw: paymentStatusRaw,
          status_normalized: paymentStatusNormalized,
          user_id: userId,
          payload: maskedResponse
        }]);

        currentStatus = paymentStatusNormalized;

        if (paymentStatusNormalized === 'approved') {
          const customerId = paymentResult.payer?.id || null;
          await BillingEngine.handlePaymentApproved(userId, customerId, paymentIdStr, paymentResult);
        }
      } catch (transitionErr) {
        console.error(`[API Payment] Transição de estado inválida ao criar: ${transitionErr.message}`);
      }
    }

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

    if (paymentStatusNormalized === 'approved') {
      res.status(200).json({ success: true, ...richResponse });
    } else if (paymentStatusNormalized === 'in_process') {
      res.status(200).json({ success: true, ...richResponse });
    } else if (paymentStatusNormalized === 'pending') {
      if (payment_method_id === 'pix') {
        const qrCode = paymentResult.point_of_interaction?.transaction_data?.qr_code;
        const qrCodeBase64 = paymentResult.point_of_interaction?.transaction_data?.qr_code_base64;
        
        res.status(200).json({ 
          success: true, 
          paymentMethod: 'pix',
          qr_code: qrCode, 
          qr_code_base64: qrCodeBase64,
          ...richResponse
        });
      } else {
        res.status(200).json({ success: true, ...richResponse });
      }
    } else {
      console.warn(`[API Payment] Pagamento não foi aprovado pelo MP. Status: ${paymentStatusNormalized}`);
      res.status(400).json({ 
        error: `Pagamento não aprovado. Status: ${paymentStatusNormalized}`, 
        success: false,
        ...richResponse
      });
    }
  } catch (error) {
    console.error('[MP] Erro crítico ao processar pagamento:', error);
    const errObj = error?.response?.data || error;
    const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV || process.env.NODE_ENV === 'test';
    if (isDev) {
      console.log("🚨 MP ERROR FULL:", typeof errObj === 'object' ? JSON.stringify(errObj, null, 2) : errObj);
    } else {
      let secureErrObj = errObj;
      try {
        if (secureErrObj && typeof secureErrObj === 'object') {
          secureErrObj = JSON.parse(JSON.stringify(errObj));
          if (secureErrObj.payer) {
            if (secureErrObj.payer.email) secureErrObj.payer.email = maskEmail(secureErrObj.payer.email);
            if (secureErrObj.payer.identification && secureErrObj.payer.identification.number) {
              secureErrObj.payer.identification.number = maskCpf(secureErrObj.payer.identification.number);
            }
          }
        }
      } catch (e) {}
      console.log("🚨 MP ERROR FULL:", typeof secureErrObj === 'object' ? JSON.stringify(secureErrObj, null, 2) : secureErrObj);
    }
    res.status(500).json({ error: 'Erro crítico interno ao processar pagamento.', message: error.message });
  }
}
