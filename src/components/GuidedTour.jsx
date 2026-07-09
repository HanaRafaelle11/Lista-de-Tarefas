import React, { useState, useEffect } from 'react';
import { Joyride, STATUS } from 'react-joyride';
import { useAppContext } from '../contexts/AppContext';

export default function GuidedTour() {
  const { currentUser, logEvent } = useAppContext();
  const [run, setRun] = useState(false);
  const [tourKey, setTourKey] = useState(0);

  useEffect(() => {
    if (!currentUser) return;
    const tourStorageKey = `flowday_tour_v2_${currentUser.id}`;
    const hasSeenTour = localStorage.getItem(tourStorageKey);
    if (!hasSeenTour) {
      const timer = setTimeout(() => {
        setRun(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentUser]);

  useEffect(() => {
    const handleStartTour = () => {
      setTourKey(prev => prev + 1);
      setRun(true);
    };
    window.addEventListener('start-flowday-tour', handleStartTour);
    return () => window.removeEventListener('start-flowday-tour', handleStartTour);
  }, []);

  const isMobile = window.innerWidth <= 768;

  const steps = [
    {
      target: isMobile ? '#tour-nav-mobile-home' : '#tour-nav-sidebar-home',
      title: 'Tudo começa aqui',
      content: 'Seu painel principal (Dashboard). Tarefas e objetivos em um só lugar, organizados pelo que mais importa agora.',
      disableBeacon: true,
      placement: isMobile ? 'top' : 'right',
    },
    {
      target: isMobile ? '#tour-nav-mobile-tasks' : '#tour-nav-sidebar-tasks',
      title: 'Seu Planejamento Diário',
      content: 'Gerencie suas tarefas e objetivos organizados por prazos ou visualize-os em um painel Kanban altamente produtivo.',
      placement: isMobile ? 'top' : 'right',
    },
    {
      target: isMobile ? '#tour-nav-mobile-focus' : '#tour-nav-sidebar-focus',
      title: 'Aumente seu Foco',
      content: 'Utilize o timer Pomodoro integrado e as sessões de foco profundo para maximizar seu rendimento diário.',
      placement: isMobile ? 'top' : 'right',
    },
    {
      target: isMobile ? '#tour-nav-mobile-analytics' : '#tour-nav-sidebar-evolution',
      title: 'Gamificação e Evolução',
      content: 'Acompanhe a evolução do seu pet virtual, consulte suas conquistas e receba análises do Coach de Produtividade.',
      placement: isMobile ? 'top' : 'right',
    },
    ...(!isMobile ? [{
      target: '#tour-nav-settings',
      title: 'Ajuste Fino',
      content: 'Acesse as configurações para gerenciar seus dados, trocar o tema visual, exportar relatórios ou enviar feedbacks.',
      placement: 'left',
    }] : [])
  ];

  const handleJoyrideCallback = (data) => {
    const { status, type, index } = data;
    const finishedStatuses = [STATUS.FINISHED, STATUS.SKIPPED];

    if (type === 'step:after') {
      const stepNumber = index + 1; // 1, 2, 3, 4
      if (stepNumber >= 1 && stepNumber <= 4) {
        logEvent('onboarding_step_completed', { step: stepNumber });
      }
    }

    if (finishedStatuses.includes(status)) {
      setRun(false);
      if (currentUser?.id) {
        localStorage.setItem(`flowday_tour_v2_${currentUser.id}`, 'true');
      }
      if (status === STATUS.FINISHED) {
        logEvent('onboarding_completed');
      }
    }
  };

  return (
    <>
      <Joyride
        key={tourKey}
        callback={handleJoyrideCallback}
        continuous
        hideCloseButton
        run={run}
        scrollToFirstStep
        showProgress
        showSkipButton
        steps={steps}
        styles={{
          options: {
            zIndex: 99999,
            primaryColor: '#6366F1',
            backgroundColor: 'var(--bg-card, #ffffff)',
            textColor: 'var(--text-main, #333333)',
          },
          buttonClose: {
            display: 'none',
          },
          buttonSkip: {
            color: '#888',
          },
          buttonNext: {
            backgroundColor: '#6366F1',
            borderRadius: '4px',
          },
          buttonBack: {
            color: '#6366F1',
          }
        }}
        locale={{
          back: 'Voltar',
          close: 'Fechar',
          last: 'Concluir',
          next: 'Avançar',
          skip: 'Pular'
        }}
      />

      {!run && (
        <button
          onClick={() => {
            setTourKey(prev => prev + 1);
            setRun(true);
          }}
          style={{
            position: 'fixed',
            bottom: isMobile ? '96px' : '24px',
            right: '24px',
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: 'var(--primary)',
            color: '#FFFFFF',
            border: 'none',
            boxShadow: 'var(--shadow-lg)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9998,
            fontSize: '18px',
            fontWeight: 'bold',
            transition: 'transform 0.2s',
          }}
          title="Iniciar Tour de Ajuda"
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          ?
        </button>
      )}
    </>
  );
}
