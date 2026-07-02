# Guia de Rotação da Service Role Key (Supabase / MyFlowDay)

Este documento descreve o procedimento operacional padrão para rotacionar com segurança a **Service Role Key** e o segredo JWT do projeto MyFlowDay sem interromper a execução dos cron jobs ou a entrega de notificações em produção.

---

## 🚨 Informações de Segurança Críticas
* A **Service Role Key** possui privilégios de superusuário administrativo (`bypass RLS`). Ela NUNCA deve ser compartilhada, exposta ao cliente ou commitada no repositório.
* Rotacionar a chave invalidará imediatamente todos os tokens antigos gerados para a service role. É necessário atualizar imediatamente todos os serviços integrados (Vercel, workers e servidores locais).

---

## 🛠️ Procedimento de Rotação

### Passo 1: Rotacionar a Chave no Console Supabase
1. Faça login no [Supabase Dashboard](https://supabase.com).
2. Selecione o projeto MyFlowDay (`mftsklhrzhhvtsuamqaw`).
3. Vá para **Settings** (ícone de engrenagem) -> **API**.
4. Role até a seção **JWT Settings**.
5. Clique em **Generate new JWT Secret** (ou *Rotate Secret*).
6. Confirme a ação. O Supabase gerará uma nova chave secreta master JWT, invalidando as chaves anteriores e criando novas chaves públicas `anon_key` e `service_role_key`.

---

### Passo 2: Copiar as Novas Credenciais
Ainda na tela **Settings -> API**, copie os seguintes valores:
* **Project API keys** -> `service_role` (secret) — Esta é a nova Service Role Key.
* **Project API keys** -> `anon` (public) — Esta é a nova Anon Key (caso aplicável).

---

### Passo 3: Atualizar o Banco de Dados (Vault)
Graças à nossa arquitetura dinâmica baseada no `supabase_vault`, o agendador `pg_cron` busca a Service Role Key automaticamente da view `vault.decrypted_secrets`. 

O Supabase **atualiza automaticamente** o segredo interno no cofre quando a chave é rotacionada via painel. No entanto, para fins de confirmação ou se você adicionou o segredo manualmente ao cofre, você pode atualizar o registro executando a query abaixo no **SQL Editor**:

```sql
-- Atualiza ou insere manualmente a chave no cofre do banco (apenas se necessário)
SELECT vault.create_secret(
  secret := 'NOVA_SERVICE_ROLE_KEY_AQUI',
  name := 'service_role_key',
  description := 'Chave Service Role ativa para disparos de Edge Functions via pg_cron'
);
```

---

### Passo 4: Atualizar as Variáveis de Ambiente na Vercel
1. Acesse o painel do seu projeto na [Vercel](https://vercel.com).
2. Vá em **Settings** -> **Environment Variables**.
3. Localize a variável `SUPABASE_SERVICE_ROLE_KEY`.
4. Edite o valor inserindo a nova chave gerada.
5. Inicie um novo deploy para propagar a nova chave para os servidores da Vercel.

---

### Passo 5: Atualizar o Ambiente Local
No arquivo `.env.local` na máquina local de desenvolvimento, altere o valor da variável correspondente:
```env
SUPABASE_SERVICE_ROLE_KEY="NOVA_SERVICE_ROLE_KEY_AQUI"
```
Reabra o console do editor ou reinicie o servidor local para carregar os novos valores.
