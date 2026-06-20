import React from 'react';
import { 
  Briefcase, 
  Home, 
  HeartPulse, 
  BookOpen, 
  Coins, 
  Book, 
  Dumbbell, 
  Users, 
  Sparkles, 
  PawPrint, 
  Layers, 
  Calendar,
  FolderOpen
} from 'lucide-react';

export default function CategoryIcon({ categoryId, size = 18, className = '' }) {
  if (!categoryId) return <FolderOpen size={size} className={className} />;

  // Normalize name: lowercase, trim, remove accents
  const normalize = (str) => {
    return str
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  const key = normalize(categoryId);

  // Mapeamento de categorias para componentes Lucide
  const map = {
    trabalho: Briefcase,
    work: Briefcase,
    job: Briefcase,
    
    casa: Home,
    home: Home,
    pessoal: Home,
    personal: Home,
    
    saude: HeartPulse,
    health: HeartPulse,
    vida: HeartPulse,
    
    estudos: BookOpen,
    study: BookOpen,
    estudo: BookOpen,
    education: BookOpen,
    
    financeiro: Coins,
    finance: Coins,
    dinheiro: Coins,
    money: Coins,
    
    leitura: Book,
    reading: Book,
    books: Book,
    book: Book,
    
    exercicios: Dumbbell,
    exercise: Dumbbell,
    exercises: Dumbbell,
    academia: Dumbbell,
    fitness: Dumbbell,
    
    familia: Users,
    family: Users,
    parentes: Users,
    
    lazer: Sparkles,
    leisure: Sparkles,
    game: Sparkles,
    musica: Sparkles,
    
    pets: PawPrint,
    pet: PawPrint,
    animal: PawPrint,
    
    projetos: Layers,
    projects: Layers,
    projeto: Layers,
    project: Layers,
    
    rotina: Calendar,
    routine: Calendar,
    diario: Calendar,
  };

  const IconComponent = map[key] || FolderOpen;

  return <IconComponent size={size} className={className} strokeWidth={2} />;
}
