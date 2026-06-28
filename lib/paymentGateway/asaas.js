import { supabaseAdmin } from '../supabase.js';
import { PLAN_PREMIUM_MONTHLY_PRICE } from '../billing/config.js';

function getAsaasEnv() {
  return process.env.ASAAS_ENV || 'production';
}

function getBaseUrl() {
  return getAsaasEnv() === 'production' 
    ? 'https://www.asaas.com/api/v3' 
    : 'https://sandbox.asaas.com/api/v3';
}

/**
 * Centralizada e resiliente: Leitura de ASAAS_API_KEY estritamente em runtime.
 * Lança erro claro fail-fast se a chave não estiver configurada.
 */
function getAsaasApiKey() {
  const apiKey = process.env.ASAAS_API_KEY ? process.env.ASAAS_API_KEY.trim() : '';
  if (!apiKey) {
    console.error('[Asaas Gateway CRITICAL] ❌ ASAAS_API_KEY não configurada no ambiente em runtime.');
    throw new Error('Configuração pendente: ASAAS_API_KEY não foi encontrada no ambiente serverless.');
  }
  return apiKey;
}

function getHeaders() {
  const apiKey = getAsaasApiKey();
  return {
    'Content-Type': 'application/json',
    'access_token': apiKey
  };
}

function formatDateISO(dateObj) {
  const d = new Date(dateObj);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Wrapper de execução HTTP resiliente para a API Asaas.
 * Garante validação runtime da chave, captura segura do corpo bruto e tratamento de erros de parse.
 */
async function safeFetchAsaas(url, options = {}) {
  const headers = { ...getHeaders(), ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });

  const rawText = await res.text().catch(() => '');
  let data = {};

  if (rawText && rawText.trim()) {
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.error(`[Asaas Response Parse Error] HTTP ${res.status} para URL ${url}. Resposta bruta:`, rawText);
      throw new Error(`Resposta inválida da API Asaas (HTTP ${res.status}). O gateway retornou formato não-JSON.`);
    }
  }

  if (!res.ok) {
    console.error(`[Asaas API Error ${res.status}] URL: ${url}`, data);
    const errorDescription = data.errors?.[0]?.description 
      || data.message 
      || (typeof data === 'string' ? data : `Erro HTTP ${res.status} retornado pelo Asaas.`);
    throw new Error(errorDescription);
  }

  return data;
}

export const AsaasGateway = {
  /**
   * Garante que o usuário possua um customer id no Asaas.
   * Busca por CPF ou E-mail antes de criar para evitar duplicidade.
   */
  async ensureCustomer(userProfile, authEmail, rawCpf) {
    const userId = userProfile.id;
    if (userProfile.asaas_customer_id && !userProfile.asaas_customer_id.startsWith('cus_simulated_')) {
      return userProfile.asaas_customer_id;
    }

    const cleanCpf = rawCpf ? rawCpf.replace(/\D/g, '') : '';
    const email = authEmail || userProfile.email || `${userId}@myflowday.com.br`;
    const name = userProfile.name || userProfile.nickname || 'Usuário MyFlowDay';

    console.log(`[ASAAS CUSTOMER LOOKUP] Buscando cliente por CPF (${cleanCpf}) ou email (${email})...`);

    try {
      const baseUrl = getBaseUrl();
      let searchUrl = `${baseUrl}/customers?email=${encodeURIComponent(email)}`;
      if (cleanCpf) {
        searchUrl += `&cpfCnpj=${cleanCpf}`;
      }

      const searchData = await safeFetchAsaas(searchUrl).catch(err => {
        console.warn('[ASAAS CUSTOMER LOOKUP WARN] Falha na busca, prosseguindo para criação:', err.message);
        return null;
      });

      if (searchData && searchData.data && searchData.data.length > 0) {
        const existingId = searchData.data[0].id;
        console.log(`[ASAAS CUSTOMER FOUND] Cliente existente encontrado no Asaas: ${existingId}`);

        try {
          await supabaseAdmin.from('profiles').update({
            asaas_customer_id: existingId,
            updated_at: new Date().toISOString()
          }).eq('id', userId);
        } catch (_) {}

        return existingId;
      }

      console.log(`[ASAAS CUSTOMER CREATE] Criando novo cliente no Asaas para userId=${userId}...`);
      const createData = await safeFetchAsaas(`${baseUrl}/customers`, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          cpfCnpj: cleanCpf,
          notificationDisabled: false
        })
      });

      const newCustomerId = createData.id;
      console.log(`[ASAAS CUSTOMER CREATED] Novo cliente gerado com sucesso: ${newCustomerId}`);

      try {
        await supabaseAdmin.from('profiles').update({
          asaas_customer_id: newCustomerId,
          updated_at: new Date().toISOString()
        }).eq('id', userId);
      } catch (_) {}

      return newCustomerId;
    } catch (err) {
      console.error('[ASAAS CUSTOMER EXCEPTION]', err.message);
      throw err;
    }
  },

  /**
   * Cria cobrança Pix (avulsa ou primeira cobrança) no Asaas.
   */
  async createPixCharge({ customerId, amount, description, externalReference }) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);

    const payload = {
      customer: customerId,
      billingType: 'PIX',
      value: Number(amount) || PLAN_PREMIUM_MONTHLY_PRICE,
      dueDate: formatDateISO(dueDate),
      description: description || 'Plano MyFlowDay Premium ⚡',
      externalReference: externalReference
    };

    console.log('[ASAAS PAYMENT CREATED] Solicitando cobrança Pix ao Asaas...', { customerId, amount, externalReference });

    const baseUrl = getBaseUrl();
    const data = await safeFetchAsaas(`${baseUrl}/payments`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const paymentId = data.id;
    let qrData = {};
    try {
      qrData = await safeFetchAsaas(`${baseUrl}/payments/${paymentId}/pixQrCode`);
    } catch (qrErr) {
      console.error(`[ASAAS PIX QRCODE ERROR]`, qrErr.message);
    }

    console.log(`[ASAAS PIX CREATED SUCCESS] Cobrança Pix ${paymentId} gerada.`);
    return {
      id: paymentId,
      status: data.status,
      value: data.value,
      netValue: data.netValue,
      invoiceUrl: data.invoiceUrl,
      bankSlipUrl: data.bankSlipUrl,
      qr_code: qrData.payload || null,
      qr_code_base64: qrData.encodedImage ? `data:image/png;base64,${qrData.encodedImage}` : null,
      expirationDate: qrData.expirationDate || data.dueDate,
      raw: data
    };
  },

  /**
   * Cria cobrança direta via Cartão de Crédito no Asaas.
   */
  async createCreditCardCharge({ customerId, amount, creditCard, creditCardHolderInfo, description, externalReference }) {
    const dueDate = formatDateISO(new Date());

    const payload = {
      customer: customerId,
      billingType: 'CREDIT_CARD',
      value: Number(amount) || PLAN_PREMIUM_MONTHLY_PRICE,
      dueDate,
      description: description || 'Plano MyFlowDay Premium ⚡',
      externalReference,
      creditCard: {
        holderName: creditCard.holderName,
        number: creditCard.number.replace(/\D/g, ''),
        expiryMonth: creditCard.expiryMonth,
        expiryYear: creditCard.expiryYear,
        ccv: creditCard.ccv
      },
      creditCardHolderInfo: {
        name: creditCardHolderInfo.name,
        email: creditCardHolderInfo.email,
        cpfCnpj: creditCardHolderInfo.cpfCnpj.replace(/\D/g, ''),
        postalCode: creditCardHolderInfo.postalCode || '01001000',
        addressNumber: creditCardHolderInfo.addressNumber || '1',
        phone: creditCardHolderInfo.phone || '11999999999'
      }
    };

    const baseUrl = getBaseUrl();
    console.log('[ASAAS CREDIT CARD CHARGE] Solicitando cobrança de cartão ao Asaas...', { customerId, amount });
    const data = await safeFetchAsaas(`${baseUrl}/payments`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    return {
      id: data.id,
      status: data.status,
      value: data.value,
      raw: data
    };
  },

  /**
   * Cria assinatura mensal recorrente no Asaas.
   */
  async createSubscription({ customerId, amount, billingType = 'PIX', creditCard, creditCardHolderInfo, description, externalReference }) {
    const nextDueDate = formatDateISO(new Date());

    const payload = {
      customer: customerId,
      billingType: billingType.toUpperCase(),
      value: Number(amount) || PLAN_PREMIUM_MONTHLY_PRICE,
      nextDueDate,
      cycle: 'MONTHLY',
      description: description || 'Assinatura Mensal MyFlowDay Premium ⚡',
      externalReference
    };

    if (billingType.toUpperCase() === 'CREDIT_CARD' && creditCard) {
      payload.creditCard = {
        holderName: creditCard.holderName,
        number: creditCard.number.replace(/\D/g, ''),
        expiryMonth: creditCard.expiryMonth,
        expiryYear: creditCard.expiryYear,
        ccv: creditCard.ccv
      };
      payload.creditCardHolderInfo = {
        name: creditCardHolderInfo.name,
        email: creditCardHolderInfo.email,
        cpfCnpj: creditCardHolderInfo.cpfCnpj.replace(/\D/g, ''),
        postalCode: creditCardHolderInfo.postalCode || '01001000',
        addressNumber: creditCardHolderInfo.addressNumber || '1',
        phone: creditCardHolderInfo.phone || '11999999999'
      };
    }

    const baseUrl = getBaseUrl();
    console.log('[SUBSCRIPTION CREATED] Solicitando assinatura ao Asaas...', { customerId, billingType });
    const data = await safeFetchAsaas(`${baseUrl}/subscriptions`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    console.log(`[SUBSCRIPTION CREATED SUCCESS] Assinatura Asaas ${data.id} criada com sucesso.`);

    let pixDetails = null;
    if (billingType.toUpperCase() === 'PIX') {
      try {
        const payData = await safeFetchAsaas(`${baseUrl}/subscriptions/${data.id}/payments`);
        if (payData.data && payData.data.length > 0) {
          const firstPaymentId = payData.data[0].id;
          const qrData = await safeFetchAsaas(`${baseUrl}/payments/${firstPaymentId}/pixQrCode`);
          pixDetails = {
            paymentId: firstPaymentId,
            qr_code: qrData.payload,
            qr_code_base64: qrData.encodedImage ? `data:image/png;base64,${qrData.encodedImage}` : null,
            expirationDate: qrData.expirationDate
          };
        }
      } catch (pixErr) {
        console.warn('[ASAAS SUBSCRIPTION PIX DETAILS FAILED]', pixErr.message);
      }
    }

    return {
      id: data.id,
      status: data.status,
      value: data.value,
      nextDueDate: data.nextDueDate,
      pixDetails,
      raw: data
    };
  },

  /**
   * Cancela assinatura no Asaas.
   */
  async cancelSubscription(subscriptionId) {
    const baseUrl = getBaseUrl();
    console.log(`[SUBSCRIPTION CANCELED] Solicitando cancelamento da assinatura ${subscriptionId}...`);
    const data = await safeFetchAsaas(`${baseUrl}/subscriptions/${subscriptionId}`, {
      method: 'DELETE'
    }).catch(err => {
      if (err.message.includes('404')) return {};
      throw err;
    });

    console.log(`[SUBSCRIPTION CANCELED SUCCESS] Assinatura ${subscriptionId} cancelada no Asaas.`);
    return { success: true, id: subscriptionId, raw: data };
  },

  /**
   * Busca detalhes de um pagamento no Asaas.
   */
  async getPayment(paymentId) {
    const baseUrl = getBaseUrl();
    return await safeFetchAsaas(`${baseUrl}/payments/${paymentId}`);
  },

  /**
   * Busca detalhes de uma assinatura no Asaas.
   */
  async getSubscription(subscriptionId) {
    const baseUrl = getBaseUrl();
    return await safeFetchAsaas(`${baseUrl}/subscriptions/${subscriptionId}`);
  }
};
