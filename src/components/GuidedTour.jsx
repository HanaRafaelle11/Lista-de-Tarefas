import React, { useState, useEffect } from 'react';
import { Joyride, STATUS } from 'react-joyride';

export default function GuidedTour() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    // Only run the tour once
    const hasSeenTour = localStorage.getItem('flowday_has_seen_tour');
    if (!hasSeenTour) {
      // Delay slightly to ensure UI is rendered
      const timer = setTimeout(() => {
        setRun(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const isMobile = window.innerWidth <= 768;
  const targetPrefix = isMobile ? '#tour-nav-mobile-' : '#tour-nav-desktop-';

  const steps = [
    {
      target: `${targetPrefix}home`,
      title: 'Mapa de Produtividade',
      content: 'Acompanhe sua produtividade através dos indicadores gerados automaticamente com base em suas tarefas concluídas, hábitos e objetivos.',
      disableBeacon: true,
    },
    {
      target: `${targetPrefix}home`,
      title: 'Radar Semanal',
      content: 'Visualize rapidamente seus pontos fortes, áreas de atenção e evolução da semana.',
    },
    {
      target: `${targetPrefix}goals`,
      title: 'Objetivos',
      content: 'Defina metas de curto, médio e longo prazo para direcionar suas ações.',
    },
    {
      target: `${targetPrefix}goals`,
      title: 'Hábitos',
      content: 'Construa consistência registrando hábitos diários e acompanhando suas sequências.',
    },
    {
      target: `${targetPrefix}tasks`,
      title: 'Kanban',
      content: 'Organize tarefas por etapas e acompanhe o progresso visualmente.',
    },
    {
      target: `${targetPrefix}analytics`,
      title: 'Relatórios',
      content: 'Analise sua evolução e desempenho através de métricas e históricos.',
    }
  ];

  const handleJoyrideCallback = (data) => {
    const { status } = data;
    const finishedStatuses = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      localStorage.setItem('flowday_has_seen_tour', 'true');
    }
  };

  return (
    <Joyride
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
          zIndex: 10000,
          primaryColor: '#4CAF50', // var(--primary) equivalent
          backgroundColor: '#ffffff',
          textColor: '#333333',
        },
        buttonClose: {
          display: 'none',
        },
        buttonSkip: {
          color: '#888',
        },
        buttonNext: {
          backgroundColor: '#4CAF50',
          borderRadius: '4px',
        },
        buttonBack: {
          color: '#4CAF50',
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
  );
}
