# Guia de Diagnóstico e Configuração do Web Push (MyFlowDay)

Este guia ajuda a identificar e resolver quaisquer falhas no pipeline de Web Push Notifications no ambiente de produção.

---

## 🔍 status Atual do Sistema (Fatos do Banco de Dados)
Executamos uma varredura diagnóstica de telemetria diretamente nas tabelas de produção do Supabase e constatamos os seguintes fatos:
1. **Assinaturas Ativas**: Existem **57 assinaturas ativas** registradas na tabela `push_subscriptions`, indicando que o fluxo de consentimento do frontend e o salvamento via Edge Function estão funcionando perfeitamente.
2. **Recebimento Confirmado**: Logs de telemetria do Service Worker registram eventos de recebimento com sucesso:
   ```json
   Event: received | Status: success | Endpoint: https://fcm.googleapis.com/...
   ```
   Isso prova que o Service Worker (`sw.js`) está rodando no dispositivo do usuário e processando o payload corretamente.

---

## 🛠️ Checklist de Solução de Problemas em Produção

### 1. Sincronizar Chaves VAPID no Supabase Cloud (Crítico)
Para que os navegadores (Chrome, Safari, Firefox) aceitem as notificações push enviadas pelo servidor, as chaves de assinatura do servidor (VAPID Private/Public) devem ser matematicamente idênticas à chave pública utilizada pelo frontend.

Se houver qualquer divergência ou se as chaves não estiverem configuradas nos segredos do Supabase Cloud, a Edge Function não conseguirá assinar a mensagem de push e a requisição falhará ou será descartada em silêncio.

**Ação:** Execute o comando abaixo no terminal da sua máquina de desenvolvimento para injetar as chaves corretas e alinhadas diretamente no seu projeto de produção do Supabase:

```bash
supabase secrets set --project-ref mftsklhrzhhvtsuamqaw VAPID_PUBLIC_KEY="BPE15kzXwmrFN2wLkTDKDhOrCurYdLHsvESaKEDCVuQq2_j7fWhVYA1jK9uXoY5l_eLBCnkzsEIEW-L-rgy6d3g" VAPID_PRIVATE_KEY="3vNvdv_O-FSgp2FBMgZq2GZH6MjIh4f7otjp-9h1ocI"
```

---

### 2. Validação do Service Worker (`sw.js`)
O Service Worker está corretamente configurado para registrar o listener nativo `'push'`:
* Ele lê o payload em formato JSON utilizando `event.data.json()`.
* Dispara `self.registration.showNotification(title, options)` com ações interativas (Abrir, Concluir, Adiar).
* Possui fallback automático para a API Vercel se as chamadas de telemetria para o Supabase falharem temporariamente.

---

### 3. Script Local de Diagnóstico
Você pode rodar a qualquer momento o nosso script local de diagnóstico para verificar o status de assinaturas no banco de dados e obter o comando de sincronização de chaves atualizado:

```bash
node scripts/diagnose_push_subscriptions.js
```
