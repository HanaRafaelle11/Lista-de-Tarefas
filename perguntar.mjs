import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

// Token configurado
const token = "";
const ai = new GoogleGenAI({ apiKey: token });

// Função para mapear sua pasta /api
function listarArquivosDaPasta(dir, listaArquivos = []) {
    if (!fs.existsSync(dir)) return listaArquivos;
    const arquivos = fs.readdirSync(dir);
    for (const arquivo of arquivos) {
        const caminhoCompleto = path.join(dir, arquivo);
        if (fs.statSync(caminhoCompleto).isDirectory()) {
            listarArquivosDaPasta(caminhoCompleto, listaArquivos);
        } else if (arquivo.endsWith('.js') || arquivo.endsWith('.ts')) {
            listaArquivos.push({
                caminho: caminhoCompleto,
                conteudo: fs.readFileSync(caminhoCompleto, 'utf8')
            });
        }
    }
    return listaArquivos;
}

async function ejecutar() {
    console.log("📂 Lendo a estrutura da sua pasta /api...");
    const arquivosApi = listarArquivosDaPasta('./api');

    const contextoDosArquivos = arquivosApi.map(f => `--- ARQUIVO: ${f.caminho} ---\n${f.conteudo}\n`).join('\n');

    // Montando o prompt em partes para evitar quebras de aspas do JavaScript
    let seuPrompt = "Gere o código JavaScript completo e pronto para eu colar dentro do arquivo api/[...routes].js.\n";
    seuPrompt += "Crie a estrutura de switch/case unificando as funções da pasta /api que você analisou anteriormente.\n";
    seuPrompt += "Mantenha as mesmas lógicas de CORS, métodos HTTP e tratamentos de erro de antes.\n\n";
    seuPrompt += "Aqui está o código atual das nossas funções para você refatorar:\n";
    seuPrompt += contextoDosArquivos;

    console.log("🤖 Enviando prompt de auditoria para o Gemini...");

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: seuPrompt,
        });

        console.log('\n--- ✨ Relatório de Auditoria e Refatoração --- \n');
        console.log(response.text);
        console.log('\n-----------------------------------------------\n');

    } catch (error) {
        console.error("❌ Erro ao chamar a IA:", error.message);
    }
}

ejecutar();
