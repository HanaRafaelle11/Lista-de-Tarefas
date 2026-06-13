# Lista-de-Tarefas
Projeto desenvolvido com Google Antigravity no curso do Senai

## Como Rodar o Projeto Localmente

1. **Instalar Dependências**:
   ```bash
   npm install
   ```

2. **Configuração de Variáveis de Ambiente**:
   Crie um arquivo `.env.local` na raiz do projeto com as chaves do Supabase (use as referências do `.env.example`):
   ```env
   VITE_SUPABASE_URL=seu_url_do_supabase
   VITE_SUPABASE_ANON_KEY=sua_anon_key_do_supabase
   ```

3. **Executar em Desenvolvimento**:
   ```bash
   npm run dev
   ```

4. **Gerar Build de Produção**:
   ```bash
   npm run build
   ```
