import React, { useState, useEffect } from 'react';
import { Joyride, STATUS } from 'react-joyride';
import { useAppContext } from '../contexts/AppContext';

export default function GuidedTour() {
  const { currentUser } = useAppContext();
  const [run, setRun] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const tourKey = `flowday_tour_v2_${currentUser.id}`;
    const hasSeenTour = localStorage.getItem(tourKey);
    if (!hasSeenTour) {
      const timer = setTimeout(() => {
        setRun(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentUser]);

  const isMobile = window.innerWidth <= 768;
  const targetPrefix = isMobile ? '#tour-nav-mobile-' : '#tour-nav-desktop-';

  const steps = [
    {
      target: `${targetPrefix}home`,
      title: 'Tudo começa aqui',
      content: 'Seu painel principal. Tarefas, hábitos e objetivos em um só lugar, organizados pelo que mais importa agora.',
      disableBeacon: true,
      placement: isMobile ? 'top' : 'bottom',
    },
    {
      target: `${targetPrefix}home`,
      title: 'Seu ritmo da semana',
      content: 'Veja como foi sua semana: onde você foi bem e onde vale prestar atenção. Tudo calculado automaticamente.',
      placement: isMobile ? 'top' : 'bottom',
    },
    {
      target: `${targetPrefix}goals`,
      title: 'Defina para onde ir',
      content: 'Crie metas e acompanhe o avanço real. Cada tarefa concluída vira progresso visível nos seus objetivos.',
      placement: isMobile ? 'top' : 'bottom',
    },
    {
      target: `${targetPrefix}goals`,
      title: 'Construa constância',
      content: 'Registre hábitos diários e veja suas sequências crescerem. Pequenos passos, todo dia.',
      placement: isMobile ? 'top' : 'bottom',
    },
    {
      target: `${targetPrefix}tasks`,
      title: 'Organize do seu jeito',
      content: 'Liste, mova e priorize suas tarefas. Você decide o formato que funciona melhor pra você: lista, kanban ou matriz.',
      placement: isMobile ? 'top' : 'bottom',
    },
    {
      target: `${targetPrefix}analytics`,
      title: 'Conheça seu padrão',
      content: 'Métricas do seu comportamento real. Descubra quando você rende mais e o que ainda pode melhorar.',
      placement: isMobile ? 'top' : 'bottom',
    }
  ];

  const handleJoyrideCallback = (data) => {
    const { status } = data;
    const finishedStatuses = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      if (currentUser?.id) {
        localStorage.setItem(`flowday_tour_v2_${currentUser.id}`, 'true');
      }
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
