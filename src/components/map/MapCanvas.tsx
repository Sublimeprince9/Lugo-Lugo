'use client';

import { useEffect, useRef, useState } from 'react';
import type { Application, Container, FederatedPointerEvent, Graphics, Text as PixiText } from 'pixi.js';

import type { Category, Stall } from '@/types/event';

const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 700;
const CATEGORY_COLORS: Record<Exclude<Category, 'All'>, number> = {
  Luxury: 0xf17bba,
  Food: 0xff9e58,
  Drinks: 0x69d8ae,
  Science: 0x76baff,
  Farming: 0xa5d86d,
  Tech: 0xc795ff,
  Other: 0xd5c88d,
};

function createBlock(
  graphics: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
) {
  graphics.rect(x, y, width, height).fill(color);
}

function createMapArt(
  PIXI: typeof import('pixi.js'),
  stalls: Stall[],
  onSelect: (stall: Stall) => void,
  visitedStallNumbers: string[] | null,
) {
  const world = new PIXI.Container();
  world.eventMode = 'static';
  world.hitArea = new PIXI.Rectangle(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  const boothMarkers = new Map<string, { marker: Container; label: PixiText }>();
  const giftCoins: Array<{ container: Container; originY: number; phase: number }> = [];

  const ground = new PIXI.Graphics();
  createBlock(ground, 0, 0, WORLD_WIDTH, WORLD_HEIGHT, 0x598b4e);
  for (let y = 0; y < WORLD_HEIGHT; y += 48) {
    for (let x = 0; x < WORLD_WIDTH; x += 48) {
      const variation = ((Math.floor(x / 48) * 7 + Math.floor(y / 48) * 11) % 3) * 0x030603;
      createBlock(ground, x + 2, y + 2, 44, 44, 0x659658 - variation);
      if ((x + y) % 5 === 0) {
        createBlock(ground, x + 10, y + 12, 4, 4, 0x80ad67);
        createBlock(ground, x + 30, y + 32, 4, 4, 0x80ad67);
      }
    }
  }
  world.addChild(ground);

  const paths = new PIXI.Graphics();
  createBlock(paths, 0, 324, WORLD_WIDTH, 72, 0xc9ad75);
  createBlock(paths, 432, 0, 82, WORLD_HEIGHT, 0xc9ad75);
  createBlock(paths, 34, 110, 892, 24, 0xc9ad75);
  createBlock(paths, 122, 134, 26, 190, 0xc9ad75);
  createBlock(paths, 742, 396, 28, 240, 0xc9ad75);
  createBlock(paths, 148, 590, 594, 26, 0xc9ad75);
  createBlock(paths, 0, 354, WORLD_WIDTH, 12, 0xd8be8a);
  createBlock(paths, 466, 0, 14, WORLD_HEIGHT, 0xd8be8a);
  world.addChild(paths);

  const plazas = new PIXI.Graphics();
  createBlock(plazas, 28, 28, 280, 70, 0x4f7d48);
  createBlock(plazas, 632, 28, 294, 70, 0x4f7d48);
  createBlock(plazas, 30, 498, 320, 78, 0x4f7d48);
  createBlock(plazas, 590, 498, 330, 78, 0x4f7d48);
  world.addChild(plazas);

  const trees = new PIXI.Graphics();
  const treePositions = [
    [40, 170], [80, 208], [366, 44], [392, 182], [560, 212], [906, 168],
    [54, 430], [374, 448], [546, 442], [868, 438], [408, 634], [836, 642],
    [254, 638], [56, 630], [897, 310], [338, 278], [590, 84], [684, 670],
  ];
  for (const [x, y] of treePositions) {
    createBlock(trees, x + 8, y + 16, 22, 18, 0x355a37);
    createBlock(trees, x + 4, y + 8, 30, 20, 0x407346);
    createBlock(trees, x + 10, y, 18, 24, 0x5f9a4f);
    createBlock(trees, x + 16, y + 32, 6, 10, 0x765238);
    createBlock(trees, x + 10, y + 8, 6, 5, 0x83b766);
  }
  world.addChild(trees);

  const signs: Array<[string, number, number, number]> = [
    ['MAIN HALL', 50, 145, 0xe9c86d],
    ['FOOD COURT', 548, 155, 0xffb368],
    ['AGRI ZONE', 62, 444, 0xa8dc78],
    ['MAKER YARD', 614, 444, 0xc49aff],
  ];
  for (const [label, x, y, color] of signs) {
    const sign = new PIXI.Graphics();
    createBlock(sign, x, y, 156, 34, 0x304b37);
    createBlock(sign, x + 4, y + 4, 148, 26, 0x233a2c);
    const text = new PIXI.Text({
      text: label,
      style: new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 12,
        fontWeight: 'bold',
        fill: color,
        letterSpacing: 1,
      }),
    });
    text.x = x + 11;
    text.y = y + 10;
    world.addChild(sign, text);
  }

  for (const stall of stalls) {
    const x = 25 + stall.x * 9.05;
    const y = 202 + stall.y * 4.55;
    const color = CATEGORY_COLORS[stall.category];
    const marker = new PIXI.Container();
    const boothGraphics = new PIXI.Graphics();
    const isVisited = visitedStallNumbers?.includes(stall.id) ?? true;
    marker.alpha = isVisited ? 1 : 0.48;

    createBlock(boothGraphics, x - 22, y + 19, 54, 8, 0x344b32);
    createBlock(boothGraphics, x - 18, y + 4, 46, 20, 0x6a4a36);
    createBlock(boothGraphics, x - 22, y - 3, 54, 12, 0xefe0ad);
    createBlock(boothGraphics, x - 22, y - 8, 54, 12, color);
    createBlock(boothGraphics, x - 15, y - 8, 6, 12, 0xf9e7bd);
    createBlock(boothGraphics, x - 2, y - 8, 6, 12, 0xf9e7bd);
    createBlock(boothGraphics, x + 11, y - 8, 6, 12, 0xf9e7bd);
    createBlock(boothGraphics, x + 23, y - 8, 6, 12, 0xf9e7bd);
    createBlock(boothGraphics, x - 5, y + 8, 18, 16, 0x365d4c);
    createBlock(boothGraphics, x - 1, y + 11, 10, 7, 0xa9d68d);

    const label = new PIXI.Text({
      text: isVisited ? stall.id : '??',
      style: new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 12,
        fontWeight: 'bold',
        fill: 0xfff2c5,
        stroke: { color: 0x263b2c, width: 4 },
      }),
    });
    label.anchor.set(0.5);
    label.x = x + 5;
    label.y = y - 20;

    if (stall.hasGiftReward) {
      const coin = new PIXI.Container();
      const coinFace = new PIXI.Graphics();
      coinFace.circle(0, 0, 10).fill(0xf6cb65).stroke({ color: 0xfff0b3, width: 2 });
      coinFace.circle(0, 0, 6).stroke({ color: 0x8c5b29, width: 1 });
      const coinText = new PIXI.Text({
        text: '¢',
        style: new PIXI.TextStyle({
          fontFamily: 'monospace',
          fontSize: 10,
          fontWeight: 'bold',
          fill: 0x65431f,
        }),
      });
      coinText.anchor.set(0.5);
      coin.addChild(coinFace, coinText);
      coin.x = x + 31;
      coin.y = y - 31;
      marker.addChild(coin);
      giftCoins.push({ container: coin, originY: coin.y, phase: giftCoins.length * 1.37 });
    }

    const target = new PIXI.Graphics();
    target.rect(x - 28, y - 18, 66, 54).fill({ color: 0xffffff, alpha: 0.001 });
    target.eventMode = 'static';
    target.cursor = 'pointer';
    target.on('pointerdown', (event: FederatedPointerEvent) => event.stopPropagation());
    target.on('pointertap', (event: FederatedPointerEvent) => {
      event.stopPropagation();
      onSelect(stall);
    });
    marker.addChild(boothGraphics, label, target);
    world.addChild(marker);
    boothMarkers.set(stall.id, { marker, label });
  }

  const marquee = new PIXI.Graphics();
  createBlock(marquee, 383, 12, 178, 48, 0x443d2d);
  createBlock(marquee, 389, 18, 166, 36, 0xf5cf73);
  createBlock(marquee, 395, 24, 154, 24, 0x334f39);
  const title = new PIXI.Text({
    text: 'LUGO FEST',
    style: new PIXI.TextStyle({
      fontFamily: 'monospace',
      fontSize: 15,
      fontWeight: 'bold',
      fill: 0xffe594,
      letterSpacing: 2,
    }),
  });
  title.anchor.set(0.5);
  title.x = 472;
  title.y = 36;
  world.addChild(marquee, title);

  return { world, boothMarkers, giftCoins };
}

export function MapCanvas({
  stalls,
  selectedStall,
  selectedCategory,
  onSelect,
  visitedStallNumbers,
}: {
  stalls: Stall[];
  selectedStall: Stall;
  selectedCategory: Category;
  onSelect: (stall: Stall) => void;
  visitedStallNumbers: string[] | null;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<Container | null>(null);
  const appRef = useRef<Application | null>(null);
  const boothMarkersRef = useRef<Map<string, { marker: Container; label: PixiText }>>(new Map());
  const visitedStallNumbersRef = useRef(visitedStallNumbers);
  visitedStallNumbersRef.current = visitedStallNumbers;
  const [zoom, setZoom] = useState(1);
  const [mapError, setMapError] = useState<string | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let cancelled = false;
    let app: Application | null = null;

    async function initializeMap() {
      if (!mount) return;
      try {
        const PIXI = await import('pixi.js');
        const nextApp = new PIXI.Application();
        await nextApp.init({
          backgroundColor: 0x598b4e,
          antialias: false,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          width: mount.clientWidth,
          height: mount.clientHeight,
          preference: 'webgl',
        });
        if (cancelled) {
          nextApp.destroy({ removeView: true });
          return;
        }
        app = nextApp;
        appRef.current = nextApp;
        nextApp.canvas.className = 'pixi-map-canvas';
        nextApp.canvas.setAttribute('aria-label', 'Interactive pixel-art map of UMA Showgrounds');
        mount.appendChild(nextApp.canvas);

        const { world, boothMarkers, giftCoins } = createMapArt(
          PIXI,
          stalls,
          onSelect,
          visitedStallNumbersRef.current,
        );
        worldRef.current = world;
        boothMarkersRef.current = boothMarkers;
        nextApp.stage.addChild(world);
        const animateGiftCoins = () => {
          const time = nextApp.ticker.lastTime / 350;
          giftCoins.forEach(({ container, originY, phase }) => {
            container.y = originY + Math.sin(time + phase) * 3;
          });
        };
        nextApp.ticker.add(animateGiftCoins);

        const fitMap = () => {
          if (!app || !mount.isConnected) return;
          const width = mount.clientWidth;
          const height = mount.clientHeight;
          app.renderer.resize(width, height);
          const scale = Math.max(width / WORLD_WIDTH, height / WORLD_HEIGHT) * zoomRef.current;
          world.scale.set(scale);
          world.position.set((width - WORLD_WIDTH * scale) / 2, (height - WORLD_HEIGHT * scale) / 2);
        };

        let dragOrigin: { x: number; y: number; worldX: number; worldY: number } | null = null;
        world.on('pointerdown', (event: FederatedPointerEvent) => {
          dragOrigin = {
            x: event.global.x,
            y: event.global.y,
            worldX: world.x,
            worldY: world.y,
          };
        });
        world.on('globalpointermove', (event: FederatedPointerEvent) => {
          if (!dragOrigin) return;
          world.position.set(
            dragOrigin.worldX + event.global.x - dragOrigin.x,
            dragOrigin.worldY + event.global.y - dragOrigin.y,
          );
        });
        world.on('pointerup', () => { dragOrigin = null; });
        world.on('pointerupoutside', () => { dragOrigin = null; });
        const handleWheel = (event: WheelEvent) => {
          event.preventDefault();
          setZoom((currentZoom) => Math.max(0.8, Math.min(1.8, currentZoom + (event.deltaY < 0 ? 0.1 : -0.1))));
        };
        mount.addEventListener('wheel', handleWheel, { passive: false });
        const resizeObserver = new ResizeObserver(fitMap);
        resizeObserver.observe(mount);
        fitMap();

        return () => {
          mount.removeEventListener('wheel', handleWheel);
          resizeObserver.disconnect();
          nextApp.ticker.remove(animateGiftCoins);
        };
      } catch (error) {
        if (!cancelled) {
          setMapError(error instanceof Error ? error.message : 'PixiJS failed to initialize the map.');
        }
      }
    }

    let dispose: (() => void) | undefined;
    void initializeMap().then((cleanup) => {
      dispose = cleanup;
    });

    return () => {
      cancelled = true;
      dispose?.();
      worldRef.current = null;
      boothMarkersRef.current.clear();
      appRef.current = null;
      app?.destroy({ removeView: true }, { children: true });
    };
  }, [onSelect, stalls]);

  useEffect(() => {
    if (!visitedStallNumbers) return;
    const visited = new Set(visitedStallNumbers);
    boothMarkersRef.current.forEach(({ marker, label }, stallNumber) => {
      const isVisited = visited.has(stallNumber);
      marker.alpha = isVisited ? 1 : 0.48;
      label.text = isVisited ? stallNumber : '??';
    });
  }, [visitedStallNumbers]);

  useEffect(() => {
    const mount = mountRef.current;
    const app = appRef.current;
    const world = worldRef.current;
    if (!mount || !app || !world) return;
    const scale = Math.max(mount.clientWidth / WORLD_WIDTH, mount.clientHeight / WORLD_HEIGHT) * zoom;
    world.scale.set(scale);
    world.position.set(
      (mount.clientWidth - WORLD_WIDTH * scale) / 2,
      (mount.clientHeight - WORLD_HEIGHT * scale) / 2,
    );
  }, [zoom]);

  return (
    <section className="pixel-map-frame" aria-label="Event map">
      <div className="pixel-map-topbar">
        <div>
          <span className="pixel-eyebrow">UMA SHOWGROUNDS · LUGOGO</span>
          <h2>EXPLORE THE FAIR</h2>
        </div>
        <div className="map-coordinate">MAP 01<span> / 03</span></div>
      </div>
      <div className="pixel-map-viewport">
        <div ref={mountRef} className="pixi-map-mount" />
        {mapError && <p className="map-error" role="alert">Map failed to load: {mapError}</p>}
        <div className="map-legend">
          <span><i className="legend-dot food-dot" /> FOOD</span>
          <span><i className="legend-dot tech-dot" /> TECH</span>
          <span><i className="legend-dot farm-dot" /> FARM</span>
          <span><i className="legend-dot undiscovered-dot" /> UNDISCOVERED</span>
          <span><i className="legend-coin">¢</i> GIFT TO CLAIM</span>
        </div>
        <div className="map-zoom-controls" aria-label="Map zoom controls">
          <button
            type="button"
            onClick={() => setZoom((currentZoom) => Math.min(1.8, currentZoom + 0.2))}
            aria-label="Zoom in"
          >+</button>
          <button
            type="button"
            onClick={() => setZoom((currentZoom) => Math.max(0.8, currentZoom - 0.2))}
            aria-label="Zoom out"
          >−</button>
        </div>
        <div className="map-current-stall">
          <span className="selected-marker" style={{ backgroundColor: `#${CATEGORY_COLORS[selectedStall.category].toString(16).padStart(6, '0')}` }} />
          <span>{selectedStall.id}</span>
          <span className="map-current-name">{selectedStall.title}</span>
          {selectedCategory !== 'All' && <span className="map-filter-tag">{selectedCategory.toUpperCase()}</span>}
        </div>
      </div>
      <div className="pixel-map-footer">
        <span><i className="pixel-live-dot" /> PIXEL MAP ONLINE</span>
        <span>DRAG TO EXPLORE · SCROLL TO ZOOM</span>
      </div>
    </section>
  );
}
