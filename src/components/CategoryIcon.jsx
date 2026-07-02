import React from 'react';
import MFIcon from './MFIcon';

export default function CategoryIcon({ categoryId, size = 18, className = '' }) {
  if (!categoryId) return <MFIcon name="tasks" size={size} className={className} />;

  // Normalize name: lowercase, trim, remove accents
  const normalize = (str) => {
    return str
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  const key = normalize(categoryId);

  // Mapeamento de categorias para ícones do MFIcon
  const map = {
    trabalho: 'career',
    work: 'career',
    job: 'career',
    carreira: 'career',
    
    casa: 'home',
    home: 'home',
    pessoal: 'home',
    personal: 'home',
    
    saude: 'health',
    health: 'health',
    vida: 'health',
    
    estudos: 'studies',
    study: 'studies',
    estudo: 'studies',
    education: 'studies',
    
    financeiro: 'finance',
    finance: 'finance',
    dinheiro: 'finance',
    money: 'finance',
    financas: 'finance',
    
    leitura: 'reading',
    reading: 'reading',
    books: 'reading',
    book: 'reading',
    
    exercicios: 'fitness',
    exercise: 'fitness',
    exercises: 'fitness',
    academia: 'fitness',
    fitness: 'fitness',
    
    familia: 'family',
    family: 'family',
    parentes: 'family',
    
    lazer: 'travel',
    leisure: 'travel',
    game: 'travel',
    musica: 'travel',
    viagem: 'travel',
    
    pets: 'pets',
    pet: 'pets',
    animal: 'pets',
    
    rotina: 'habits',
    routine: 'habits',
    diario: 'habits',
    habitos: 'habits',

    sono: 'sleep',
    sleep: 'sleep',

    alimentacao: 'nutrition',
    nutrition: 'nutrition',
    comida: 'nutrition',
    food: 'nutrition',

    objetivos: 'objectives',
    goals: 'objectives',
  };

  const iconName = map[key] || 'tasks';

  return <MFIcon name={iconName} size={size} className={className} />;
}
