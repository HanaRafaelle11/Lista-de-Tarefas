import React, { useState, useEffect } from 'react';
import { Settings, User, Moon, Sun, Bell, Shield, Heart, BellOff, BellRing, CheckCircle, Award, MessageSquare, Calendar, X, Download, AlertTriangle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useNotifications } from '../hooks/useNotifications';
import { useAppContext } from '../contexts/AppContext';
import { exportAllTasksToCalendar } from '../services/googleCalendarService';

export default function SettingsView() {
  const {
    theme,
    setTheme,
    appBgColor,
    setAppBgColor,
    currentUser,
    handleLogout,
    isPro,
    handleSimulateUpgrade,
    tasks,
    allTasks,
    allGoals,
    goals,
    consistencyScore,
    habitsManager,
    deletedTasks,
    deletedGoals,
    handleRestoreTask,
    handleDeleteTaskPermanent,
    handleRestoreGoal,
    handleDeleteGoalPermanent,
    openPaywall,
    handleCancelSubscription
  } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('idle'); // idle, sending, sent, error
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('general'); // 'general' | 'trash'
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const notifications = useNotifications();

  // MFA States
  const [mfaStatus, setMfaStatus] = useState('loading'); // 'loading', 'unconfigured', 'enrolling', 'verified'
  const [mfaFactorId, setMfaFactorId] = useState(null);
  const [mfaSecret, setMfaSecret] = useState(null);
  const [mfaQrCode, setMfaQrCode] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState(null);
  const [mfaSuccess, setMfaSuccess] = useState(null);

  const loadMfaStatus = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      
      const verifiedTotp = data.totp || [];
      if (verifiedTotp.length > 0) {
        const verifiedFactor = verifiedTotp.find(f => f.status === 'verified');
        if (verifiedFactor) {
          setMfaFactorId(verifiedFactor.id);
          setMfaStatus('verified');
          return;
        }
      }
      setMfaStatus('unconfigured');
    } catch (err) {
      console.error('[MFA] Erro ao listar fatores:', err.message);
      setMfaStatus('unconfigured');
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadMfaStatus();
    }
  }, [currentUser]);

  const handleMfaEnroll = async () => {
    setLoading(true);
    setMfaError(null);
    setMfaSuccess(null);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `MyFlowDay (${currentUser?.email})`
      });
      if (error) throw error;

      setMfaFactorId(data.id);
      setMfaSecret(data.totp.secret);
      setMfaQrCode(data.totp.qr_code);
      setMfaStatus('enrolling');
    } catch (err) {
      setMfaError('Erro ao iniciar ativação de MFA: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async () => {
    if (!mfaCode || mfaCode.length !== 6) {
      setMfaError('Por favor, digite o código de 6 dígitos.');
      return;
    }
    setLoading(true);
    setMfaError(null);
    setMfaSuccess(null);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challengeData.id,
        code: mfaCode,
      });
      if (verifyError) throw verifyError;

      setMfaSuccess('Autenticação em Duas Etapas (MFA) ativada com sucesso!');
      setMfaCode('');
      setMfaSecret(null);
      setMfaQrCode(null);
      setMfaStatus('verified');
      loadMfaStatus();
    } catch (err) {
      setMfaError('Código inválido ou expirado. Tente novamente: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMfaCancel = async () => {
    setLoading(true);
    setMfaError(null);
    setMfaSuccess(null);
    try {
      if (mfaFactorId) {
        await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
      }
      setMfaFactorId(null);
      setMfaSecret(null);
      setMfaQrCode(null);
      setMfaCode('');
      setMfaStatus('unconfigured');
    } catch (err) {
      console.error('[MFA] Erro ao cancelar enrollment:', err.message);
      setMfaStatus('unconfigured');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaDisable = async () => {
    if (!window.confirm('Tem certeza que deseja desativar a Autenticação em Duas Etapas (MFA)? Sua conta ficará menos protegida.')) return;
    setLoading(true);
    setMfaError(null);
    setMfaSuccess(null);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
      if (error) throw error;
      
      setMfaSuccess('MFA desativado com sucesso.');
      setMfaFactorId(null);
      setMfaStatus('unconfigured');
    } catch (err) {
      setMfaError('Erro ao desativar MFA: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(currentUser.email);
      if (error) throw error;
      alert('Email de redefinição de senha enviado!');
    } catch (e) {
      alert('Erro ao enviar email: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Tem certeza que deseja excluir sua conta? Seus dados serão mantidos por 30 dias para recuperação (Soft Delete).')) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          account_status: 'deleted',
          deleted_at: new Date().toISOString()
        }
      });
      if (error) throw error;
      alert('Conta desativada com sucesso. Você será desconectado.');
      handleLogout();
    } catch (e) {
      alert('Erro ao excluir conta: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportGoogleCalendar = () => {
    exportAllTasksToCalendar(tasks);
    window.open('https://calendar.google.com/calendar/r/settings/export', '_blank');
    setIsSyncModalOpen(false);
  };

  const handleExportIcsOnly = () => {
    exportAllTasksToCalendar(tasks);
    setIsSyncModalOpen(false);
  };

  const calcStreakLocal = (tasksList) => {
    const completed = tasksList.filter(t => t.completed && (t.dueDate || t.completedAt));
    if (completed.length === 0) return 0;
    const dates = [...new Set(completed.map(t => t.completedAt?.split('T')[0] || t.dueDate))].sort().reverse();
    if (dates.length === 0) return 0;
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    if (dates[0] !== todayStr && dates[0] !== yesterdayStr) return 0;
    let streakCount = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i-1]);
      const curr = new Date(dates[i]);
      const diff = (prev - curr) / (1000 * 60 * 60 * 24);
      if (diff === 1) streakCount++;
      else if (diff > 1) break;
    }
    return streakCount;
  };

  const handleExportCSVData = () => {
    if (!isPro) {
      openPaywall('export_csv');
      return;
    }
    const header = "Tipo,Título,Categoria,Prioridade,Status,Criado Em,Concluído Em,Data Limite\n";
    const tasksRows = (allTasks || []).map(t => {
      const title = `"${t.title.replace(/"/g, '""')}"`;
      const category = `"${(t.category || '').replace(/"/g, '""')}"`;
      const status = t.completed ? "Concluído" : "Pendente";
      return `Tarefa,${title},${category},${t.priority || ''},${status},${t.createdAt || ''},${t.completedAt || ''},${t.dueDate || ''}`;
    });
    const goalsRows = (allGoals || []).map(g => {
      const title = `"${g.title.replace(/"/g, '""')}"`;
      const status = g.status === 'completed' ? "Alcançado" : "Ativo";
      return `Objetivo,${title},,,${status},${g.created_at || ''},${g.updated_at || ''},${g.target_date || ''}`;
    });
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + header + [...tasksRows, ...goalsRows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `myflowday_progresso_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDFData = () => {
    if (!isPro) {
      openPaywall('export_pdf');
      return;
    }
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Por favor, libere popups para gerar o relatório em PDF.");
      return;
    }

    const today = new Date().toLocaleDateString('pt-BR');
    const tasksList = (allTasks || []).filter(t => !t.deletedAt);
    const goalsList = (allGoals || []).filter(g => !g.deletedAt);
    const habitsList = habitsManager?.habits || [];

    const tasksHtml = tasksList.map(t => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; font-size: 13px;">${t.title}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; font-size: 13px;">${t.category || 'Geral'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; font-size: 13px;">${t.priority}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; font-size: 13px;">${t.completed ? 'Concluída ✅' : 'Pendente ⏳'}</td>
      </tr>
    `).join('');

    const goalsHtml = goalsList.map(g => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; font-size: 13px;">${g.icon || '🎯'} ${g.title}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; font-size: 13px;">${g.status === 'completed' ? 'Alcançado 🏆' : 'Ativo ⚡'}</td>
      </tr>
    `).join('');

    const habitsHtml = habitsList.map(h => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; font-size: 13px;">${h.title}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; font-size: 13px;">${h.frequency === 'diaria' ? 'Diário' : 'Semanal'}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório de Evolução MyFlowDay - ${today}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 40px; }
            h1 { color: #0284c7; font-size: 24px; margin-bottom: 4px; }
            .subtitle { color: #64748b; font-size: 14px; margin-bottom: 24px; }
            h2 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-top: 30px; font-size: 16px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { text-align: left; background-color: #f8fafc; padding: 10px 8px; border-bottom: 2px solid #e2e8f0; font-size: 13px; color: #475569; }
            td { font-size: 13px; color: #1e293b; }
          </style>
        </head>
        <body>
          <h1>Relatório de Evolução MyFlowDay ⚡</h1>
          <div class="subtitle">Gerado em: ${today} | Score de Consistência Atual: ${consistencyScore}/100</div>

          <h2>Objetivos</h2>
          <table>
            <thead>
              <tr><th>Objetivo</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${goalsHtml || '<tr><td colspan="2" style="padding:8px;color:#94a3b8;">Nenhum objetivo registrado</td></tr>'}
            </tbody>
          </table>

          <h2>Tarefas</h2>
          <table>
            <thead>
              <tr><th>Título</th><th>Categoria</th><th>Prioridade</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${tasksHtml || '<tr><td colspan="4" style="padding:8px;color:#94a3b8;">Nenhuma tarefa registrada</td></tr>'}
            </tbody>
          </table>

          <h2>Hábitos</h2>
          <table>
            <thead>
              <tr><th>Hábito</th><th>Frequência</th></tr>
            </thead>
            <tbody>
              ${habitsHtml || '<tr><td colspan="2" style="padding:8px;color:#94a3b8;">Nenhum hábito registrado</td></tr>'}
            </tbody>
          </table>

          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleExportPNGData = () => {
    if (!isPro) {
      openPaywall('export_png');
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");

    // Background Gradient (Flowday style)
    const gradient = ctx.createLinearGradient(0, 0, 600, 400);
    gradient.addColorStop(0, '#0f172a'); // Dark slate
    gradient.addColorStop(1, '#1e1b4b'); // Deep indigo
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 600, 400);

    // Accent lighting glows
    ctx.fillStyle = 'rgba(2, 132, 199, 0.15)'; // Cyan glow
    ctx.beginPath();
    ctx.arc(100, 100, 150, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(99, 102, 241, 0.12)'; // Indigo glow
    ctx.beginPath();
    ctx.arc(500, 300, 180, 0, Math.PI * 2);
    ctx.fill();

    // Border highlights
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 580, 380);

    // Header Branding
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText("MyFlowDay ⚡", 40, 60);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px sans-serif';
    ctx.fillText("MEU DIÁRIO DE EVOLUÇÃO", 40, 85);

    // Date
    const today = new Date().toLocaleDateString('pt-BR');
    ctx.textAlign = 'right';
    ctx.fillText(today, 560, 60);
    ctx.textAlign = 'left';

    // Consistency Score Big Circle
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.beginPath();
    ctx.arc(140, 240, 75, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(140, 240, 75, 0, Math.PI * 2);
    ctx.stroke();

    // Actual Score Progress Arc (Cyan color)
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (Math.PI * 2 * (consistencyScore / 100));
    ctx.arc(140, 240, 75, startAngle, endAngle);
    ctx.stroke();

    // Text inside Score Circle
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(consistencyScore), 140, 240);
    
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.fillText("Consistência", 140, 270);
    ctx.textAlign = 'left';

    // Stats Column
    const activeTasks = (allTasks || []).filter(t => !t.deletedAt);
    const completedTasksCount = activeTasks.filter(t => t.completed).length;
    const activeGoalsCount = (allGoals || []).filter(g => !g.deletedAt && g.status === 'active').length;
    const streak = calcStreakLocal(allTasks || []);

    const drawStat = (label, value, y) => {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px sans-serif';
      ctx.fillText(label, 270, y);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(String(value), 270, y + 25);
    };

    drawStat("Tarefas Concluídas", completedTasksCount, 160);
    drawStat("Objetivos Ativos", activeGoalsCount, 240);
    drawStat("Streak Atual", `${streak} ${streak === 1 ? 'dia' : 'dias'} 🔥`, 320);

    // Footer message
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = 'italic 11px sans-serif';
    ctx.fillText("Construindo hábitos e autoconhecimento diário.", 40, 370);

    // Trigger download
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `myflowday_evolucao_${new Date().toISOString().split('T')[0]}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSendFeedback = async () => {
    if (!feedbackText.trim()) {
      alert('Por favor, escreva seu feedback antes de enviar.');
      return;
    }
    setFeedbackStatus('sending');
    let emailSent = false;

    // 1. Tenta inserir na tabela 'feedback' do Supabase
    try {
      const { error: dbError } = await supabase
        .from('feedback')
        .insert({
          message: feedbackText.trim(),
          user_id: currentUser?.id || null,
          user_email: currentUser?.email || null,
          created_at: new Date().toISOString(),
        });
      if (dbError) {
        console.warn('[Feedback] Tabela não encontrada ou falha ao inserir no banco:', dbError.message);
      }
    } catch (e) {
      console.warn('[Feedback] Falha ao tentar gravar no banco de dados:', e.message);
    }

    // 2. Tenta disparar a Edge Function do Supabase
    if (supabase.functions && typeof supabase.functions.invoke === 'function') {
      try {
        const { error: funcError } = await supabase.functions.invoke('send-feedback-email', {
          body: {
            message: feedbackText.trim(),
            userId: currentUser?.id || null,
            userEmail: currentUser?.email || null,
          }
        });
        if (!funcError) {
          emailSent = true;
          console.log('[Feedback] E-mail enviado com sucesso via Edge Function.');
        } else {
          console.warn('[Feedback] Edge Function retornou erro:', funcError.message);
        }
      } catch (err) {
        console.warn('[Feedback] Falha ao invocar Edge Function:', err.message);
      }
    }

    // 3. Fallback: Se a Edge Function não enviou o e-mail, tenta via FormSubmit.co
    if (!emailSent) {
      try {
        const adminEmails = ['admin@flowday.app', 'rafaelle@flowday.app', 'rafox@flowday.app'];
        const userEmail = currentUser?.email || '';
        // Envia para o próprio e-mail do admin logado se for teste, ou para o admin principal
        const recipientEmail = adminEmails.includes(userEmail) ? userEmail : 'rafaelle@flowday.app';
        
        console.log(`[Feedback] Enviando e-mail de feedback via FormSubmit para: ${recipientEmail}`);
        const response = await fetch(`https://formsubmit.co/ajax/${recipientEmail}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            name: currentUser?.name || 'Usuário Flowday',
            email: userEmail || 'no-reply@flowday.app',
            message: feedbackText.trim(),
            _subject: `Novo Feedback do Flowday - ${userEmail || 'Anônimo'}`,
          })
        });

        if (response.ok) {
          const resData = await response.json();
          if (resData.success === 'true' || resData.success === true) {
            emailSent = true;
            console.log('[Feedback] E-mail enviado com sucesso via FormSubmit.');
          } else {
            console.warn('[Feedback] FormSubmit retornou resposta negativa:', resData);
          }
        } else {
          console.warn('[Feedback] Resposta HTTP negativa do FormSubmit:', response.status);
        }
      } catch (err) {
        console.warn('[Feedback] Erro no fallback do FormSubmit:', err.message);
      }
    }

    // 4. Conclusão do envio
    if (emailSent) {
      setFeedbackText('');
      setFeedbackStatus('sent');
      setTimeout(() => setFeedbackStatus('idle'), 4000);
    } else {
      // Se ambos falharam (ex: sem internet), salva em localStorage como fallback de emergência
      console.warn('[Feedback] Salvando localmente devido a falhas em todos os canais de envio.');
      try {
        const localFeedbackKey = 'flowday_local_feedback';
        const existing = JSON.parse(localStorage.getItem(localFeedbackKey) || '[]');
        existing.push({
          message: feedbackText.trim(),
          user_id: currentUser?.id || 'demo-user',
          user_email: currentUser?.email || 'demo@flowday.app',
          created_at: new Date().toISOString(),
          synced: false
        });
        localStorage.setItem(localFeedbackKey, JSON.stringify(existing));
        
        setFeedbackText('');
        setFeedbackStatus('sent'); // Exibe "sent" para o usuário indicando gravação (offline)
        setTimeout(() => setFeedbackStatus('idle'), 4000);
      } catch (localErr) {
        console.error('[Feedback] Erro fatal ao salvar feedback localmente:', localErr);
        setFeedbackStatus('error');
        setTimeout(() => setFeedbackStatus('idle'), 4000);
      }
    }
  };

  const renderTrashTab = () => {
    const hasItems = deletedTasks.length > 0 || deletedGoals.length > 0;
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239, 68, 68, 0.1)', fontSize: '13px', color: 'var(--text-muted)' }}>
          ⚠️ Os itens excluídos permanecem na lixeira por 30 dias antes de serem eliminados permanentemente de forma automática.
        </div>

        {!hasItems ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
            <span style={{ fontSize: '32px' }}>🗑️</span>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginTop: '12px', color: 'var(--text-main)' }}>Lixeira Vazia</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px' }}>
              Nenhuma tarefa ou objetivo foi removido recentemente.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {deletedGoals.length > 0 && (
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', color: 'var(--text-main)', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>Objetivos Excluídos</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {deletedGoals.map(goal => (
                    <div key={goal.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-app)' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{goal.title}</span>
                      </span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={() => handleRestoreGoal(goal.id)}
                          style={{ fontSize: '12px', fontWeight: '600', padding: '6px 12px', color: 'var(--primary)', backgroundColor: 'var(--primary-light)', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Restaurar
                        </button>
                        <button 
                          onClick={() => handleDeleteGoalPermanent(goal.id)}
                          style={{ fontSize: '12px', fontWeight: '600', padding: '6px 12px', color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Excluir permanente
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {deletedTasks.length > 0 && (
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', color: 'var(--text-main)', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>Tarefas Excluídas</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {deletedTasks.map(task => (
                    <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-app)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>{task.title}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-light)' }}>Categoria: {task.category}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={() => handleRestoreTask(task.id)}
                          style={{ fontSize: '12px', fontWeight: '600', padding: '6px 12px', color: 'var(--primary)', backgroundColor: 'var(--primary-light)', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Restaurar
                        </button>
                        <button 
                          onClick={() => handleDeleteTaskPermanent(task.id)}
                          style={{ fontSize: '12px', fontWeight: '600', padding: '6px 12px', color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Excluir permanente
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="settings-view animate-fade-in" style={{ padding: '24px 0' }}>
      <div className="tasks-page-header" style={{ marginBottom: '32px' }}>
        <h1 className="tasks-page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={24} /> Configurações
        </h1>
        <p className="tasks-page-subtitle">Ajuste suas preferências</p>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
        <button
          onClick={() => setSettingsTab('general')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '600',
            backgroundColor: settingsTab === 'general' ? 'var(--primary-light)' : 'transparent',
            color: settingsTab === 'general' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          Configurações Gerais
        </button>
        <button
          onClick={() => setSettingsTab('trash')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '600',
            backgroundColor: settingsTab === 'trash' ? 'var(--primary-light)' : 'transparent',
            color: settingsTab === 'trash' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          Lixeira
        </button>
      </div>

      {settingsTab === 'general' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Perfil */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <User size={18} /> Sua Conta
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <span style={{ fontSize: '12px', color: 'var(--text-light)', textTransform: 'uppercase' }}>Nome</span>
              <p style={{ fontSize: '15px', color: 'var(--text-main)', fontWeight: '500' }}>{currentUser.name}</p>
            </div>
            <div style={{ marginTop: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-light)', textTransform: 'uppercase' }}>Email</span>
              <p style={{ fontSize: '15px', color: 'var(--text-main)', fontWeight: '500' }}>{currentUser.email}</p>
            </div>
            <button 
              onClick={handlePasswordReset} 
              disabled={loading}
              style={{ alignSelf: 'flex-start', marginTop: '16px', color: 'var(--primary)', fontWeight: '600', fontSize: '14px', padding: '8px 16px', backgroundColor: 'var(--primary-light)', borderRadius: '6px' }}
            >
              Redefinir Senha
            </button>
          </div>
        </div>

        {/* Segurança e Autenticação MFA */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Shield size={18} /> Segurança da Conta
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {mfaError && (
              <div style={{ backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '13px', textAlign: 'center' }}>
                {mfaError}
              </div>
            )}
            {mfaSuccess && (
              <div style={{ backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '13px', textAlign: 'center' }}>
                {mfaSuccess}
              </div>
            )}

            {mfaStatus === 'loading' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-light)', fontSize: '14px' }}>
                <div className="app-loading-spinner" style={{ width: '16px', height: '16px' }} />
                Carregando status de segurança...
              </div>
            )}

            {mfaStatus === 'unconfigured' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-light)', textTransform: 'uppercase' }}>Status de Duas Etapas (MFA)</span>
                  <span style={{ fontSize: '11px', fontWeight: '750', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--prio-alta-bg)', color: 'var(--prio-alta-text)' }}>Desativado</span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-light)', lineHeight: '1.5', margin: 0 }}>
                  A autenticação em duas etapas adiciona uma camada extra de segurança para a sua conta do MyFlowDay. Para entrar, além da senha, você precisará fornecer um código temporário de 6 dígitos gerado no celular.
                </p>
                <button
                  onClick={handleMfaEnroll}
                  disabled={loading}
                  style={{ alignSelf: 'flex-start', color: 'white', fontWeight: '600', fontSize: '13px', padding: '8px 16px', backgroundColor: 'var(--primary)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Configurar Autenticação em Duas Etapas
                </button>
              </div>
            )}

            {mfaStatus === 'enrolling' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>Scan do Código de Segurança</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-light)', lineHeight: '1.5', margin: 0 }}>
                  Abra seu aplicativo de autenticação (como Google Authenticator ou Authy), escaneie o código QR abaixo e insira o código de 6 dígitos gerado para concluir a ativação.
                </p>
                
                {/* QR Code Container */}
                {mfaQrCode && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '16px', backgroundColor: 'white', borderRadius: '8px', alignSelf: 'center' }}>
                    {mfaQrCode.trim().startsWith('<svg') ? (
                      <div dangerouslySetInnerHTML={{ __html: mfaQrCode }} style={{ width: '180px', height: '180px' }} />
                    ) : (
                      <img src={mfaQrCode} alt="TOTP QR Code" style={{ width: '180px', height: '180px' }} />
                    )}
                  </div>
                )}

                {mfaSecret && (
                  <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Chave Secreta (Configuração Manual)</span>
                    <code style={{ fontSize: '14px', color: 'var(--text-main)', fontWeight: '700', letterSpacing: '1px', wordBreak: 'break-all', fontFamily: 'monospace' }}>{mfaSecret}</code>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)' }}>Código de 6 dígitos</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                    style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', width: '140px', fontSize: '16px', letterSpacing: '2px', textAlign: 'center' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleMfaVerify}
                    disabled={loading || mfaCode.length !== 6}
                    style={{ color: 'white', fontWeight: '600', fontSize: '13px', padding: '8px 16px', backgroundColor: 'var(--primary)', border: 'none', borderRadius: '6px', cursor: 'pointer', opacity: mfaCode.length === 6 ? 1 : 0.6 }}
                  >
                    Confirmar e Ativar
                  </button>
                  <button
                    onClick={handleMfaCancel}
                    disabled={loading}
                    style={{ color: 'var(--text-muted)', fontWeight: '600', fontSize: '13px', padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid var(--border-medium)', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {mfaStatus === 'verified' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-light)', textTransform: 'uppercase' }}>Status de Duas Etapas (MFA)</span>
                  <span style={{ fontSize: '11px', fontWeight: '750', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>MFA Ativado</span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-light)', lineHeight: '1.5', margin: 0 }}>
                  Sua conta está altamente protegida com autenticação em duas etapas TOTP baseada em app autenticador.
                </p>
                <button
                  onClick={handleMfaDisable}
                  disabled={loading}
                  style={{ alignSelf: 'flex-start', color: '#c06c6c', fontWeight: '600', fontSize: '13px', padding: '8px 16px', backgroundColor: '#faf0f0', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Desativar Autenticação em Duas Etapas
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Assinatura SaaS (Simulador Pro) - Bloco 6 */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Award size={18} /> Assinatura Flowday
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '8px', borderRadius: '50%', backgroundColor: isPro ? 'var(--primary-light)' : 'var(--border-medium)', color: isPro ? 'var(--primary)' : 'var(--text-light)' }}>
                <Award size={24} />
              </div>
              <div>
                <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)' }}>
                  Plano Atual: {isPro ? 'Flowday Pro ⚡' : 'Flowday Grátis'}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                  {isPro 
                    ? 'Você possui acesso ilimitado a todos os recursos de evolução pessoal.'
                    : 'Acesse ferramentas avançadas de produtividade, foco e IA.'}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                if (isPro) {
                  setIsCancelModalOpen(true);
                } else {
                  openPaywall('settings_page');
                }
              }}
              style={{
                alignSelf: 'flex-start',
                marginTop: '8px',
                padding: '10px 20px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: isPro ? 'var(--prio-alta-bg)' : 'var(--primary)',
                color: isPro ? 'var(--prio-alta-text)' : 'white',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                border: isPro ? '1px solid var(--prio-alta-border)' : 'none'
              }}
            >
              {isPro ? 'Cancelar Assinatura Pro (Simulado)' : 'Ativar Flowday Pro ⚡'}
            </button>
          </div>
        </div>

        {/* Exportação de Dados */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Download size={18} /> Exportar Dados
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-light)', lineHeight: '1.5', margin: '0 0 16px' }}>
            Faça download dos seus objetivos, tarefas e rotinas em múltiplos formatos. Recursos exclusivos do plano Pro.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={handleExportCSVData}
              style={{
                padding: '10px 16px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-main)',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              CSV
            </button>
            <button
              onClick={handleExportPDFData}
              style={{
                padding: '10px 16px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-main)',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              PDF (Relatório)
            </button>
            <button
              onClick={handleExportPNGData}
              style={{
                padding: '10px 16px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-main)',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              PNG (Card de Progresso)
            </button>
          </div>
        </div>

        {/* Modal de Cancelamento Pro */}
        {isCancelModalOpen && (
          <div 
            className="modal-overlay" 
            onClick={() => setIsCancelModalOpen(false)}
            style={{ 
              position: 'fixed', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              backgroundColor: 'rgba(0,0,0,0.6)', 
              backdropFilter: 'blur(8px)',
              zIndex: 99999, 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center' 
            }}
          >
            <div 
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{ 
                maxWidth: '440px', 
                width: '95%', 
                padding: '24px', 
                backgroundColor: 'var(--bg-card)', 
                borderRadius: 'var(--radius-lg)', 
                border: '1px solid var(--border-light)',
                textAlign: 'center'
              }}
            >
              <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', backgroundColor: 'rgba(192, 108, 108, 0.1)', color: '#C06C6C', marginBottom: '16px' }}>
                <AlertTriangle size={32} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '850', color: 'var(--text-main)', margin: '0 0 12px' }}>
                Sentiremos sua falta no Pro! 🥺
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6', margin: '0 0 20px' }}>
                Ao cancelar sua assinatura, seu histórico continuará salvo de forma segura, mas você voltará a ver <strong>apenas os últimos 30 dias</strong> na sua linha de tempo e perderá o acesso ao Coach MyFlowDay, análises avançadas e sincronização de calendários.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={() => setIsCancelModalOpen(false)}
                  style={{ width: '100%', padding: '12px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                >
                  Manter Assinatura Pro ⚡
                </button>
                <button
                  onClick={async () => {
                    await handleCancelSubscription();
                    setIsCancelModalOpen(false);
                    alert("Sua assinatura Pro foi cancelada. Você retornou ao plano gratuito.");
                  }}
                  style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-medium)', backgroundColor: 'transparent', color: '#c06c6c', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
                >
                  Confirmar Cancelamento (Simulado)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Configurações de Produtividade */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Calendar size={18} /> Configurações de Produtividade
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-main)', fontWeight: '500', margin: 0 }}>
              Sincronização do Calendário de Tarefas
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-light)', lineHeight: '1.5', margin: 0 }}>
              Exporte e integre todas as suas tarefas ativas e com data definida em qualquer calendário externo (Google Calendar, Apple Calendar, Outlook) via arquivo iCalendar.
            </p>
            <button
              onClick={() => {
                if (!isPro) {
                  openPaywall('google_calendar');
                } else {
                  setIsSyncModalOpen(true);
                }
              }}
              style={{
                alignSelf: 'flex-start',
                marginTop: '8px',
                padding: '10px 20px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--primary)',
                color: 'white',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Calendar size={14} /> Sincronizar Calendário
            </button>
          </div>
        </div>

        {/* Aparência */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Moon size={18} /> Aparência
          </h2>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { id: 'light', label: 'Claro', icon: <Sun size={16} /> },
              { id: 'dark', label: 'Escuro', icon: <Moon size={16} /> },
              { id: 'system', label: 'Sistema', icon: <Settings size={16} /> }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px',
                  border: `1px solid ${theme === t.id ? 'var(--primary)' : 'var(--border-medium)'}`,
                  backgroundColor: theme === t.id ? 'var(--primary-glow)' : 'var(--bg-app)',
                  color: theme === t.id ? 'var(--primary)' : 'var(--text-main)',
                  fontWeight: theme === t.id ? '600' : '500',
                  transition: 'all 0.2s'
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {theme !== 'dark' && (
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)', display: 'block', marginBottom: '10px' }}>
                Cor de Fundo Personalizada (Modo Claro)
              </span>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {[
                  { color: '#F8FAFC', label: 'Padrão' },
                  { color: '#FAF5FF', label: 'Lilás' },
                  { color: '#F0F9FF', label: 'Azul' },
                  { color: '#F0FDF4', label: 'Menta' },
                  { color: '#FFF7ED', label: 'Pêssego' }
                ].map(bg => (
                  <button
                    key={bg.color}
                    onClick={() => setAppBgColor(bg.color)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: `1.5px solid ${appBgColor === bg.color ? 'var(--primary)' : 'var(--border-medium)'}`,
                      backgroundColor: bg.color,
                      color: 'var(--text-main)',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: bg.color, border: '1px solid var(--border-medium)', display: 'inline-block' }} />
                    {bg.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '12px' }}>
            O Flowday se adapta à sua preferência. O modo escuro reduz o cansaço visual.
          </p>
        </div>

        {/* Notificações */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Bell size={18} /> Notificações do Navegador
          </h2>

          {!notifications.isSupported ? (
            <p style={{ fontSize: '13px', color: 'var(--text-light)' }}>
              Seu navegador não suporta notificações.
            </p>
          ) : notifications.permission === 'denied' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--prio-alta-text)' }}>
                <BellOff size={16} />
                <span style={{ fontSize: '13px', fontWeight: '600' }}>Notificações bloqueadas</span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                Você bloqueou as notificações no navegador. Para reativar, acesse as configurações do seu navegador e permita notificações para este site.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Toggle principal */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>
                    {notifications.isEnabled ? 'Notificações ativas' : 'Notificações desativadas'}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '2px' }}>
                    {notifications.isEnabled
                      ? 'Você receberá lembretes e alertas do Flowday. Funciona com o app aberto (foreground).'
                      : 'Ative para receber lembretes de tarefas e conquistas.'}
                  </p>
                </div>
                {/* Botão toggle */}
                <button
                  id="notifications-toggle-btn"
                  onClick={notifications.isEnabled ? notifications.disableNotifications : notifications.requestPermission}
                  style={{
                    position: 'relative',
                    width: '44px',
                    height: '24px',
                    borderRadius: '99px',
                    backgroundColor: notifications.isEnabled ? 'var(--primary)' : 'var(--border-medium)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.25s',
                    flexShrink: 0,
                  }}
                  aria-label={notifications.isEnabled ? 'Desativar notificações' : 'Ativar notificações'}
                >
                  <span style={{
                    position: 'absolute',
                    top: '3px',
                    left: notifications.isEnabled ? '23px' : '3px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    transition: 'left 0.25s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </button>
              </div>

              {/* Status e ações */}
              {notifications.isEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontSize: '12px', fontWeight: '600' }}>
                    <CheckCircle size={14} />
                    Permissão concedida pelo navegador
                  </div>
                  <button
                    id="notifications-test-btn"
                    onClick={() => notifications.sendNotification('Flowday 🔔', {
                      body: 'Notificações estão funcionando! Você será avisado sobre suas tarefas.',
                      tag: 'flowday-test',
                    })}
                    style={{
                      alignSelf: 'flex-start',
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: '600',
                      borderRadius: '6px',
                      backgroundColor: 'var(--primary-light)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <BellRing size={13} /> Enviar notificação de teste
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Seção de Feedback */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <MessageSquare size={18} /> Compartilhe com o MyFlowDay
          </h2>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Compartilhe suas ideias, problemas ou sugestões com o MyFlowDay..."
            rows="5"
            style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', resize: 'vertical', fontSize: '14px' }}
          />
          <button
            onClick={handleSendFeedback}
            disabled={feedbackStatus === 'sending'}
            style={{
              marginTop: '12px',
              padding: '10px 20px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: feedbackStatus === 'sent' ? '#22c55e' : (feedbackStatus === 'error' ? '#ef4444' : 'var(--primary)'),
              color: 'white',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              justifyContent: 'center'
            }}
          >
            {feedbackStatus === 'sending' && <><span>Enviando...</span></>}
            {feedbackStatus === 'sent' && <><span>✅ Enviado!</span></>}
            {feedbackStatus === 'error' && <><span>❌ Erro!</span></>}
            {feedbackStatus === 'idle' && <><span>Enviar Feedback</span></>}
          </button>
          {feedbackStatus === 'sent' && <p style={{ fontSize: '12px', color: '#22c55e', marginTop: '8px' }}>Obrigado pelo seu feedback!</p>}
          {feedbackStatus === 'error' && <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '8px' }}>Não foi possível enviar o feedback. Tente novamente.</p>}
        </div>

        {/* PWA & Sistema */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Shield size={18} /> Flowday v1.0
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-light)' }}>
            <p>Plataforma de Progresso Pessoal</p>
            <p>Construído para clareza, evolução e consistência.</p>
            <p style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
              Desenvolvido por Hana Oliveira.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' }}>
            <button 
              onClick={handleLogout} 
              style={{ padding: '12px 24px', backgroundColor: '#FAF0F0', color: '#C06C6C', borderRadius: '8px', fontWeight: '600' }}
            >
              Sair da minha conta
            </button>
            <button 
              onClick={handleDeleteAccount} 
              disabled={loading}
              style={{ padding: '12px 24px', backgroundColor: 'transparent', border: '1px solid #C06C6C', color: '#C06C6C', borderRadius: '8px', fontWeight: '600' }}
            >
              Excluir minha conta
            </button>
          </div>
        </div>

        </div>
      ) : (
        renderTrashTab()
      )}

      {/* Modal de Escolha de Sincronização do Calendário */}
      {isSyncModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSyncModalOpen(false)} style={{ zIndex: 12000 }}>
          <div 
            className="modal-content" 
            role="dialog" 
            aria-modal="true" 
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '420px', width: '90%', padding: '24px', textAlign: 'center', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} style={{ color: 'var(--primary)' }} /> Sincronizar Calendário
              </h3>
              <button 
                onClick={() => setIsSyncModalOpen(false)} 
                className="todo-modal-close-btn"
                style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.5', textAlign: 'left' }}>
              Escolha o formato que preferir para integrar suas tarefas agendadas ao seu calendário pessoal:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={handleExportGoogleCalendar}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-app)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'border-color 0.2s',
                  width: '100%',
                }}
              >
                <span style={{ fontSize: '24px' }}>📅</span>
                <div>
                  <strong style={{ display: 'block', fontSize: '13px', color: 'var(--text-main)' }}>Google Calendar (Recomendado)</strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>Exporta o arquivo .ics e abre a página de importação do Google.</span>
                </div>
              </button>

              <button
                onClick={handleExportIcsOnly}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-app)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'border-color 0.2s',
                  width: '100%',
                }}
              >
                <span style={{ fontSize: '24px' }}>📥</span>
                <div>
                  <strong style={{ display: 'block', fontSize: '13px', color: 'var(--text-main)' }}>Baixar arquivo .ics</strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>Apenas exporta e baixa o arquivo de calendário para programas locais.</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
