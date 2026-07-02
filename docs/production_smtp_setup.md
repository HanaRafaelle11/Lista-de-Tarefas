# Configuração de SMTP Externo em Produção (Resend / Supabase Auth)

Para evitar os limites do plano gratuito do Supabase (50 e-mails por dia) e garantir a entrega de links mágicos, e-mails de confirmação e redefinições de senha sem interrupções sob alta carga, você deve configurar o **Resend** (ou outro provedor SMTP externo) nas configurações do Supabase.

---

## 📧 Passo 1: Configurar seu Domínio no Resend

1. Crie uma conta em [resend.com](https://resend.com).
2. Acesse **Domains** > **Add Domain**.
3. Insira o domínio oficial `myflowday.com.br`.
4. Adicione as chaves DNS geradas (registros `TXT` para SPF/DKIM e `MX` para recepção) no seu provedor de DNS (ex: Cloudflare, GoDaddy, Registro.br).
5. Clique em **Verify** no painel do Resend e aguarde o status mudar para **Verified** (pode levar alguns minutos).

---

## 🔑 Passo 2: Gerar Credenciais SMTP no Resend

1. No painel do Resend, navegue até **API Keys**.
2. Clique em **Create API Key**.
3. Dê um nome para a chave (ex: `Supabase Auth Production`), selecione a permissão **Sending access** para o seu domínio e clique em **Add**.
4. Copie a chave gerada (ela começará com `re_...`). **Ela será a sua senha SMTP.**

---

## ⚙️ Passo 3: Configurar o SMTP no Supabase Dashboard

1. Acesse o [Supabase Console](https://supabase.com/dashboard).
2. Selecione o seu projeto de produção.
3. No menu lateral, acesse **Settings** > **Auth** > **SMTP Settings** (em "Email Provider").
4. Ative a opção **Enable Custom SMTP**.
5. Preencha as credenciais SMTP do Resend exatamente como listado abaixo:

| Campo | Valor Recomendado |
| :--- | :--- |
| **Sender Email** | `no-reply@myflowday.com.br` |
| **Sender Name** | `MyFlowDay` |
| **SMTP Host** | `smtp.resend.com` |
| **SMTP Port** | `587` (ou `465` para SSL) |
| **Secure Connection** | `STARTTLS` (se porta 587) ou `SSL` (se porta 465) |
| **SMTP Username** | `resend` (literalmente a palavra "resend") |
| **SMTP Password** | Sua chave de API do Resend (ex: `re_123456789...`) |

6. Clique em **Save** na parte inferior da tela.

---

## 🛡️ Passo 4: Fallbacks e Resiliência (Frontend)

O frontend do MyFlowDay já possui uma infraestrutura preparada para e-mail delivery:
- **Rate-Limiting (Anti-Spam)**: O botão de envio de link mágico e recuperação de senha fica desabilitado por 60 segundos com contagem regressiva persistente (no `localStorage`) para evitar abusos e spams que gastem a cota.
- **Detecção de Erro e Fallback**: Se o envio falhar (por exemplo, por erro no SMTP do Supabase), o frontend captura a exceção, exibe uma mensagem amigável instruindo o usuário a aguardar ou tentar outro método, e grava o log de falha na tabela `auth_logs` para acompanhamento do administrador.
