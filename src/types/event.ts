export type Category = 'All' | 'Luxury' | 'Food' | 'Drinks' | 'Science' | 'Farming' | 'Tech';

export type Stall = {
  id: string;
  title: string;
  category: Exclude<Category, 'All'>;
  zone: string;
  x: number;
  y: number;
  description: string;
  whatsapp: string;
  price: string;
};

export type EventStat = {
  label: string;
  value: string;
  tone: 'amber' | 'cyan' | 'violet';
};
