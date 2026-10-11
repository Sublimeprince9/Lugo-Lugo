import type { Category, Stall } from '@/types/event';

export const categories: Category[] = ['All', 'Luxury', 'Food', 'Drinks', 'Science', 'Farming', 'Tech'];

export const categoryStyles: Record<Exclude<Category, 'All'>, string> = {
  Luxury: 'luxury',
  Food: 'food',
  Drinks: 'drinks',
  Science: 'science',
  Farming: 'farming',
  Tech: 'tech',
};

export const stalls: Stall[] = [
  { id: 'A12', title: 'Nile Glass Atelier', category: 'Luxury', zone: 'Main Hall', x: 22, y: 22, description: 'Handcrafted glassware, home accents and premium gift baskets.', whatsapp: '+256700123456', price: 'UGX 180k - 1.4M' },
  { id: 'B07', title: 'Kampala Bites', category: 'Food', zone: 'Catering Lane', x: 47, y: 26, description: 'Street-food favourites and local delicacies from across Uganda.', whatsapp: '+256772555111', price: 'UGX 5k - 28k' },
  { id: 'C04', title: 'Sunrise Sips', category: 'Drinks', zone: 'Brew Hall', x: 68, y: 31, description: 'Cold-pressed juices, smoothies and artisanal sodas.', whatsapp: '+256750888222', price: 'UGX 3k - 14k' },
  { id: 'D09', title: 'Agri Lab', category: 'Science', zone: 'Innovation Hub', x: 34, y: 52, description: 'Climate-smart farming demos and agritech experiments.', whatsapp: '+256774400333', price: 'UGX 12k - 120k' },
  { id: 'E18', title: 'Royal Rice Fields', category: 'Farming', zone: 'Agri Court', x: 58, y: 55, description: 'Seed varieties, soil health products and local crop cultivation kits.', whatsapp: '+256788666444', price: 'UGX 8k - 90k' },
  { id: 'F03', title: 'Pixels & Circuits', category: 'Tech', zone: 'Maker District', x: 76, y: 60, description: 'Robotics demos, consumer gadgets and app prototypes.', whatsapp: '+256756777555', price: 'UGX 25k - 450k' },
  { id: 'A18', title: 'Kampala Craft House', category: 'Luxury', zone: 'Main Hall', x: 28, y: 38, description: 'Premium handmade baskets, textiles and limited-run home decor.', whatsapp: '+256788121212', price: 'UGX 35k - 420k' },
  { id: 'B12', title: 'Hot Pot Corner', category: 'Food', zone: 'Catering Lane', x: 58, y: 42, description: 'Grilled favourites, shawarma and festival comfort food.', whatsapp: '+256755222333', price: 'UGX 7k - 30k' },
  { id: 'C11', title: 'Mango Mash', category: 'Drinks', zone: 'Brew Hall', x: 82, y: 50, description: 'Fresh fruit blends and premium mocktails for the crowd.', whatsapp: '+256774333444', price: 'UGX 4k - 18k' },
  { id: 'D21', title: 'Bio Garden Lab', category: 'Science', zone: 'Innovation Hub', x: 42, y: 68, description: 'Plant research, composting hacks and regenerative agriculture stories.', whatsapp: '+256700333222', price: 'UGX 10k - 80k' },
  { id: 'E22', title: 'FarmFresh Co-op', category: 'Farming', zone: 'Agri Court', x: 69, y: 74, description: 'Local farmer co-op products, pulses and climate resilient seeds.', whatsapp: '+256701444121', price: 'UGX 9k - 75k' },
  { id: 'F15', title: 'Pico Labs', category: 'Tech', zone: 'Maker District', x: 82, y: 76, description: 'Wearables, smart farming tools and urban innovation prototypes.', whatsapp: '+256756111777', price: 'UGX 20k - 500k' },
];

export const eventStats = [
  { label: 'Coins', value: '640', tone: 'amber' as const },
  { label: 'Visited', value: '12/30', tone: 'cyan' as const },
  { label: 'Rank', value: '#41', tone: 'violet' as const },
];

export const leaderboard = [
  { name: 'Amina', coins: 920, visited: 18 },
  { name: 'Joel', coins: 820, visited: 16 },
  { name: 'You', coins: 640, visited: 12 },
];
