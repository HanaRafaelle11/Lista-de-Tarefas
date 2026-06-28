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

function getApiKey() {
  return process.env.ASAAS_API_KEY || '';
}

function getHeaders() {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[Asaas Gateway] ⚠️ ASAAS_API_KEY não configurada no ambiente.');
  }
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
      
      const searchRes = await fetch(searchUrl, { headers: getHeaders() });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.data && searchData.data.length > 0) {
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
      }

      console.log(`[ASAAS CUSTOMER CREATE] Criando novo cliente no Asaas para userId=${userId}...`);
      const createRes = await fetch(`${baseUrl}/customers`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          cpfCnpj: cleanCpf,
          notificationDisabled: false
        })
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        console.error('[ASAAS CUSTOMER CREATE ERROR]', createData);
        const errMsg = createData.errors?.map(e => e.description).join('; ') || JSON.stringify(createData);
        throw new Error(`Asaas Customer Error: ${errMsg}`);
      }

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
    const res = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[ASAAS PIX CREATE ERROR]', data);
      throw new Error(data.errors?.[0]?.description || 'Falha ao gerar cobrança Pix no Asaas.');
    }

    const paymentId = data.id;

    const qrRes = await fetch(`${baseUrl}/payments/${paymentId}/pixQrCode`, {
      headers: getHeaders()
    });

    let qrData = {};
    if (qrRes.ok) {
      qrData = await qrRes.json();
    } else {
      const errTxt = await qrRes.text().catch(() => '');
      console.error(`[ASAAS PIX QRCODE ERROR ${qrRes.status}]`, errTxt);
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
    const res = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[ASAAS CREDIT CARD ERROR]', data);
      throw new Error(data.errors?.[0]?.description || 'Falha ao processar pagamento com cartão.');
    }

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
    const res = await fetch(`${baseUrl}/subscriptions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[ASAAS SUBSCRIPTION ERROR]', data);
      throw new Error(data.errors?.[0]?.description || 'Falha ao criar assinatura no Asaas.');
    }

    console.log(`[SUBSCRIPTION CREATED SUCCESS] Assinatura Asaas ${data.id} criada com sucesso.`);

    let pixDetails = null;
    if (billingType.toUpperCase() === 'PIX') {
      try {
        const payRes = await fetch(`${baseUrl}/subscriptions/${data.id}/payments`, { headers: getHeaders() });
        if (payRes.ok) {
          const payData = await payRes.json();
          if (payData.data && payData.data.length > 0) {
            const firstPaymentId = payData.data[0].id;
            const qrRes = await fetch(`${baseUrl}/payments/${firstPaymentId}/pixQrCode`, { headers: getHeaders() });
            if (qrRes.ok) {
              const qrData = await qrRes.json();
              pixDetails = {
                paymentId: firstPaymentId,
                qr_code: qrData.payload,
                qr_code_base64: qrData.encodedImage ? `data:image/png;base64,${qrData.encodedImage}` : null,
                expirationDate: qrData.expirationDate
              };
            }
          }
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
    const res = await fetch(`${baseUrl}/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 404) {
      console.error('[ASAAS SUBSCRIPTION CANCEL ERROR]', data);
      throw new Error(data.errors?.[0]?.description || 'Falha ao cancelar assinatura no Asaas.');
    }

    console.log(`[SUBSCRIPTION CANCELED SUCCESS] Assinatura ${subscriptionId} cancelada no Asaas.`);
    return { success: true, id: subscriptionId, raw: data };
  },

  /**
   * Busca detalhes de um pagamento no Asaas.
   */
  async getPayment(paymentId) {
    const baseUrl = getBaseUrl();
    const res = await fetch(`${baseUrl}/payments/${paymentId}`, {
      headers: getHeaders()
    });
    if (!res.ok) {
      throw new Error(`Falha ao buscar pagamento no Asaas: ${res.status}`);
    }
    return await res.json();
  },

  /**
   * Busca detalhes de uma assinatura no Asaas.
   */
  async getSubscription(subscriptionId) {
    const baseUrl = getBaseUrl();
    const res = await fetch(`${baseUrl}/subscriptions/${subscriptionId}`, {
      headers: getHeaders()
    });
    if (!res.ok) {
      throw new Error(`Falha ao buscar assinatura no Asaas: ${res.status}`);
    }
    return await res.json();
  }
};
