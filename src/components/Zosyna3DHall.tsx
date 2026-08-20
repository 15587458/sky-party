import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { ChartElement, Event, TerritoryConfig } from '../types';
import { ZOSYNA_ELEMENTS } from '../data/zosynaPreset';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize2, 
  Sparkles,
  Move,
  Orbit,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Music,
  Compass,
  LayoutGrid,
  Info,
  Crown,
  Hand
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Zosyna3DHallProps {
  elements?: ChartElement[];
  occupiedIds?: string[];
  selectedId?: string | null;
  territory?: TerritoryConfig;
  onSelect?: (element: ChartElement, quantity?: number) => void;
  onElementMove?: (elementId: string, newX: number, newY: number) => void;
  event?: Event;
  ticketType?: 'standard' | 'vip';
  readOnly?: boolean;
  editable?: boolean;
  className?: string;
}

// 3D Table Mapping - Default Presets
export interface Table3DDef {
  elementId: string;
  label: string;
  number: string;
  zone: 'stage' | 'fanzone' | 'left' | 'right' | 'bottom';
  x: number;
  z: number;
  y?: number;
  width: number;
  depth: number;
  shape: 'rect' | 'round';
  chairs: number;
  color: string;
  isVip: boolean;
  rotation?: number; // rotation in degrees
}

export const ZOSYNA_3D_TABLES: Table3DDef[] = [
  // ЛІВИЙ СЕКТОР (Left Wing) - Всі столи VIP (№ 1 - 6)
  { elementId: 'table-1', label: 'Стіл 1', number: '1', zone: 'left', x: -44, z: -18, y: 0, width: 9, depth: 9, shape: 'round', chairs: 4, color: '#eab308', isVip: true },
  { elementId: 'table-2', label: 'Стіл 2', number: '2', zone: 'left', x: -68, z: -20, y: 0, width: 12, depth: 8, shape: 'rect', chairs: 6, color: '#eab308', isVip: true },
  { elementId: 'table-3', label: 'Стіл 3', number: '3', zone: 'left', x: -70, z: -2, y: 0, width: 12, depth: 8, shape: 'rect', chairs: 6, color: '#eab308', isVip: true },
  { elementId: 'table-4', label: 'Стіл 4', number: '4', zone: 'left', x: -55, z: -2, y: 0, width: 12, depth: 8, shape: 'rect', chairs: 6, color: '#eab308', isVip: true },
  { elementId: 'table-5', label: 'Стіл 5', number: '5', zone: 'left', x: -76, z: 20, y: 0, width: 12, depth: 8, shape: 'rect', chairs: 6, color: '#eab308', isVip: true },
  { elementId: 'table-6', label: 'Стіл 6', number: '6', zone: 'left', x: -60, z: 20, y: 0, width: 10, depth: 8, shape: 'rect', chairs: 4, color: '#eab308', isVip: true },

  // НИЖНІЙ РЯД СТОЛІВ (Bottom Row) - Всі столи VIP (№ 7 - 14)
  { elementId: 'table-7', label: 'Стіл 7', number: '7', zone: 'bottom', x: -80, z: 46, y: 0, width: 12, depth: 8, shape: 'rect', chairs: 6, color: '#eab308', isVip: true },
  { elementId: 'table-8', label: 'Стіл 8', number: '8', zone: 'bottom', x: -64, z: 46, y: 0, width: 12, depth: 8, shape: 'rect', chairs: 6, color: '#eab308', isVip: true },
  { elementId: 'table-9', label: 'Стіл 9', number: '9', zone: 'bottom', x: -46, z: 46, y: 0, width: 11, depth: 8, shape: 'rect', chairs: 6, color: '#eab308', isVip: true },
  { elementId: 'table-10', label: 'Стіл 10', number: '10', zone: 'bottom', x: -32, z: 46, y: 0, width: 11, depth: 8, shape: 'rect', chairs: 6, color: '#eab308', isVip: true },
  { elementId: 'table-11', label: 'Стіл 11', number: '11', zone: 'bottom', x: -18, z: 46, y: 0, width: 11, depth: 8, shape: 'rect', chairs: 6, color: '#eab308', isVip: true },
  { elementId: 'table-12', label: 'Стіл 12', number: '12', zone: 'bottom', x: -4, z: 46, y: 0, width: 11, depth: 8, shape: 'rect', chairs: 6, color: '#eab308', isVip: true },
  { elementId: 'table-13', label: 'Стіл 13', number: '13', zone: 'bottom', x: 10, z: 46, y: 0, width: 11, depth: 8, shape: 'rect', chairs: 6, color: '#eab308', isVip: true },
  { elementId: 'table-14', label: 'Стіл 14', number: '14', zone: 'bottom', x: 24, z: 46, y: 0, width: 11, depth: 8, shape: 'rect', chairs: 6, color: '#eab308', isVip: true },

  // ПРАВИЙ СЕКТОР (Right Wing) - Всі столи VIP (№ 15 - 28)
  { elementId: 'table-15', label: 'Стіл 15', number: '15', zone: 'right', x: 52, z: -22, y: 0, width: 12, depth: 8, shape: 'rect', chairs: 6, color: '#eab308', isVip: true },
  { elementId: 'table-16', label: 'Стіл 16', number: '16', zone: 'right', x: 67, z: -22, y: 0, width: 12, depth: 8, shape: 'rect', chairs: 6, color: '#eab308', isVip: true },
  { elementId: 'table-17', label: 'Стіл 17', number: '17', zone: 'right', x: 82, z: -22, y: 0, width: 12, depth: 8, shape: 'rect', chairs: 6, color: '#eab308', isVip: true },
  { elementId: 'table-18', label: 'Стіл 18', number: '18', zone: 'right', x: 40, z: -5, y: 0, width: 10, depth: 8, shape: 'rect', chairs: 6, color: '#eab308', isVip: true },
  { elementId: 'table-19', label: 'Стіл 19', number: '19', zone: 'right', x: 54, z: -5, y: 0, width: 10, depth: 8, shape: 'rect', chairs: 6, color: '#eab308', isVip: true },
  { elementId: 'table-20', label: 'Стіл 20', number: '20', zone: 'right', x: 68, z: -5, y: 0, width: 10, depth: 8, shape: 'rect', chairs: 6, color: '#eab308', isVip: true },
  { elementId: 'table-21', label: 'Стіл 21', number: '21', zone: 'right', x: 82, z: -5, y: 0, width: 10, depth: 8, shape: 'rect', chairs: 4, color: '#eab308', isVip: true },
  { elementId: 'table-22', label: 'Стіл 22', number: '22', zone: 'right', x: 44, z: 15, y: 0, width: 9, depth: 9, shape: 'round', chairs: 5, color: '#eab308', isVip: true },
  { elementId: 'table-23', label: 'Стіл 23', number: '23', zone: 'right', x: 85, z: 12, y: 0, width: 10, depth: 7, shape: 'rect', chairs: 4, color: '#eab308', isVip: true },
  { elementId: 'table-24', label: 'Стіл 24', number: '24', zone: 'right', x: 88, z: 27, y: 0, width: 13, depth: 8, shape: 'rect', chairs: 6, color: '#eab308', isVip: true },
  { elementId: 'table-25', label: 'Стіл 25', number: '25', zone: 'right', x: 48, z: 33, y: 0, width: 11, depth: 8, shape: 'rect', chairs: 6, color: '#eab308', isVip: true },
  { elementId: 'table-26', label: 'Стіл 26', number: '26', zone: 'right', x: 63, z: 33, y: 0, width: 11, depth: 8, shape: 'rect', chairs: 6, color: '#eab308', isVip: true },
  { elementId: 'table-27', label: 'Стіл 27', number: '27', zone: 'right', x: 77, z: 33, y: 0, width: 8, depth: 7, shape: 'rect', chairs: 4, color: '#eab308', isVip: true },
  { elementId: 'table-28', label: 'Стіл 28', number: '28', zone: 'right', x: 92, z: 46, y: 0, width: 13, depth: 8, shape: 'rect', chairs: 6, color: '#eab308', isVip: true }
];

// 2D to 3D Coordinate Mapping constants:
const SCALE_X = 0.178;
const SCALE_Z = 0.155;
const OFFSET_3D_Z = 10;

export const get3DPosition = (
  x2d: number, 
  y2d: number, 
  width2d = 0, 
  height2d = 0, 
  isPoint = false,
  rotationDeg = 0,
  territoryWidth = 1200,
  territoryHeight = 800
) => {
  const center2DX = territoryWidth / 2 - 50;
  const center2DY = territoryHeight / 2 - 20;

  let cX = x2d;
  let cY = y2d;
  if (!isPoint && (width2d > 0 || height2d > 0)) {
    const halfW = width2d / 2;
    const halfH = height2d / 2;
    if (!rotationDeg) {
      cX = x2d + halfW;
      cY = y2d + halfH;
    } else {
      const rad = (rotationDeg * Math.PI) / 180;
      cX = x2d + halfW * Math.cos(rad) - halfH * Math.sin(rad);
      cY = y2d + halfW * Math.sin(rad) + halfH * Math.cos(rad);
    }
  }
  return {
    x: (cX - center2DX) * SCALE_X,
    z: (cY - center2DY) * SCALE_Z + OFFSET_3D_Z
  };
};

export const get2DPositionFrom3D = (
  x3d: number, 
  z3d: number, 
  width2d = 0, 
  height2d = 0, 
  isPoint = false,
  rotationDeg = 0,
  territoryWidth = 1200,
  territoryHeight = 800
) => {
  const center2DX = territoryWidth / 2 - 50;
  const center2DY = territoryHeight / 2 - 20;

  const cX = (x3d / SCALE_X) + center2DX;
  const cY = ((z3d - OFFSET_3D_Z) / SCALE_Z) + center2DY;
  let newX = cX;
  let newY = cY;
  if (!isPoint && (width2d > 0 || height2d > 0)) {
    const halfW = width2d / 2;
    const halfH = height2d / 2;
    if (!rotationDeg) {
      newX = cX - halfW;
      newY = cY - halfH;
    } else {
      const rad = (rotationDeg * Math.PI) / 180;
      newX = cX - (halfW * Math.cos(rad) - halfH * Math.sin(rad));
      newY = cY - (halfW * Math.sin(rad) + halfH * Math.cos(rad));
    }
  }
  return {
    x: Math.max(0, Math.min(territoryWidth, Math.round(newX))),
    y: Math.max(0, Math.min(territoryHeight, Math.round(newY)))
  };
};

export default function Zosyna3DHall({
  elements = ZOSYNA_ELEMENTS,
  occupiedIds = [],
  selectedId,
  territory,
  onSelect,
  onElementMove,
  event,
  ticketType = 'standard',
  readOnly = false,
  editable = false,
  className
}: Zosyna3DHallProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hoveredElement, setHoveredElement] = useState<{ 
    id: string; 
    label: string; 
    zone: string; 
    isVip?: boolean; 
    isFanzone?: boolean; 
    isArchitectural?: boolean; 
    seats: number; 
    price?: number 
  } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cameraView, setCameraView] = useState<'iso' | 'top' | 'stage' | 'fanzone' | 'tables'>('iso');
  const [controlMode, setControlMode] = useState<'orbit' | 'pan'>('orbit');
  const [showGestureTip, setShowGestureTip] = useState(true);

  // Auto-hide gesture tip after 6s
  useEffect(() => {
    const timer = setTimeout(() => setShowGestureTip(false), 6000);
    return () => clearTimeout(timer);
  }, []);

  // Internal scene references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const interactiveMeshesRef = useRef<Map<string, THREE.Mesh | THREE.Group>>(new Map());
  const tablesContainerRef = useRef<THREE.Group | null>(null);
  const architectureGroupRef = useRef<THREE.Group | null>(null);
  const lightsRef = useRef<{
    ambient: THREE.AmbientLight;
    sun: THREE.DirectionalLight;
    spot1: THREE.SpotLight;
    spot2: THREE.SpotLight;
    fanGlow: THREE.PointLight;
    leftFill: THREE.PointLight;
    rightFill: THREE.PointLight;
  } | null>(null);

  // Helper to rebuild architecture, walls, floor, and lighting according to territory config
  const updateArchitectureAndLights = useCallback((t?: TerritoryConfig) => {
    const scene = sceneRef.current;
    const archGroup = architectureGroupRef.current;
    const lights = lightsRef.current;
    if (!scene || !archGroup || !lights) return;

    const w2D = t?.width || 1200;
    const h2D = t?.height || 800;
    const floor3DW = w2D * SCALE_X + 24;
    const floor3DD = h2D * SCALE_Z + 24;
    const wallH = t?.wallHeight !== undefined ? t.wallHeight : (t?.venueType === 'openair' ? 0 : 16);
    const wallVisible = (t?.wallVisible !== false) && (t?.venueType !== 'openair') && wallH > 0;
    const wallColor = t?.wallColor || '#334155';
    const floorMatType = t?.floorMaterial || 'concrete';
    const preset = t?.lightingPreset || (t?.venueType === 'openair' ? 'night_festival' : 'neon_club');

    // 1. Lighting presets configuration
    let bgHex = '#0c0d12';
    let fogDensity = 0.0035;

    if (preset === 'daylight') {
      bgHex = '#1e293b';
      fogDensity = 0.002;
      scene.background = new THREE.Color(bgHex);
      scene.fog = new THREE.FogExp2(bgHex, fogDensity);
      lights.ambient.color.set('#e0f2fe');
      lights.ambient.intensity = 2.2;
      lights.sun.color.set('#fffbeb');
      lights.sun.intensity = 2.6;
      lights.spot1.color.set('#ffffff');
      lights.spot1.intensity = 4;
      lights.spot2.color.set('#ffffff');
      lights.spot2.intensity = 4;
      lights.fanGlow.color.set('#38bdf8');
      lights.fanGlow.intensity = 2.0;
      lights.leftFill.color.set('#fbbf24');
      lights.leftFill.intensity = 1.5;
      lights.rightFill.color.set('#fbbf24');
      lights.rightFill.intensity = 1.5;
    } else if (preset === 'warm_ambient') {
      bgHex = '#140f07';
      fogDensity = 0.004;
      scene.background = new THREE.Color(bgHex);
      scene.fog = new THREE.FogExp2(bgHex, fogDensity);
      lights.ambient.color.set('#fef3c7');
      lights.ambient.intensity = 1.6;
      lights.sun.color.set('#fde68a');
      lights.sun.intensity = 2.0;
      lights.spot1.color.set('#f59e0b');
      lights.spot1.intensity = 7;
      lights.spot2.color.set('#fbbf24');
      lights.spot2.intensity = 7;
      lights.fanGlow.color.set('#d97706');
      lights.fanGlow.intensity = 3.0;
      lights.leftFill.color.set('#f59e0b');
      lights.leftFill.intensity = 2.5;
      lights.rightFill.color.set('#f59e0b');
      lights.rightFill.intensity = 2.5;
    } else if (preset === 'night_festival') {
      bgHex = '#050508';
      fogDensity = 0.0045;
      scene.background = new THREE.Color(bgHex);
      scene.fog = new THREE.FogExp2(bgHex, fogDensity);
      lights.ambient.color.set('#1e1b4b');
      lights.ambient.intensity = 0.9;
      lights.sun.color.set('#818cf8');
      lights.sun.intensity = 1.2;
      lights.spot1.color.set('#ec4899');
      lights.spot1.intensity = 12;
      lights.spot2.color.set('#06b6d4');
      lights.spot2.intensity = 12;
      lights.fanGlow.color.set('#c084fc');
      lights.fanGlow.intensity = 4.0;
      lights.leftFill.color.set('#6366f1');
      lights.leftFill.intensity = 2.2;
      lights.rightFill.color.set('#06b6d4');
      lights.rightFill.intensity = 2.2;
    } else if (preset === 'cyberpunk') {
      bgHex = '#09090b';
      fogDensity = 0.004;
      scene.background = new THREE.Color(bgHex);
      scene.fog = new THREE.FogExp2(bgHex, fogDensity);
      lights.ambient.color.set('#312e81');
      lights.ambient.intensity = 1.2;
      lights.sun.color.set('#e11d48');
      lights.sun.intensity = 1.8;
      lights.spot1.color.set('#10b981');
      lights.spot1.intensity = 11;
      lights.spot2.color.set('#f43f5e');
      lights.spot2.intensity = 11;
      lights.fanGlow.color.set('#06b6d4');
      lights.fanGlow.intensity = 4.0;
      lights.leftFill.color.set('#10b981');
      lights.leftFill.intensity = 2.5;
      lights.rightFill.color.set('#f43f5e');
      lights.rightFill.intensity = 2.5;
    } else {
      // Standard Neon Club
      bgHex = '#0c0d12';
      fogDensity = 0.0035;
      scene.background = new THREE.Color(bgHex);
      scene.fog = new THREE.FogExp2(bgHex, fogDensity);
      lights.ambient.color.set('#f8fafc');
      lights.ambient.intensity = 1.45;
      lights.sun.color.set('#fffbeb');
      lights.sun.intensity = 1.9;
      lights.spot1.color.set('#a855f7');
      lights.spot1.intensity = 9;
      lights.spot2.color.set('#38bdf8');
      lights.spot2.intensity = 9;
      lights.fanGlow.color.set('#9333ea');
      lights.fanGlow.intensity = 3.5;
      lights.leftFill.color.set('#eab308');
      lights.leftFill.intensity = 2.2;
      lights.rightFill.color.set('#eab308');
      lights.rightFill.intensity = 2.2;
    }

    // 2. Clear previous architecture meshes
    while (archGroup.children.length > 0) {
      archGroup.remove(archGroup.children[0]);
    }

    // 3. Create Floor Material based on territory configuration
    let defaultColor = '#d4d4d8';
    let roughness = 0.55;
    let metalness = 0.08;

    if (floorMatType === 'parquet') {
      defaultColor = '#451a03';
      roughness = 0.32;
      metalness = 0.06;
    } else if (floorMatType === 'grass') {
      defaultColor = '#1b431b';
      roughness = 0.95;
      metalness = 0.0;
    } else if (floorMatType === 'dark_slate') {
      defaultColor = '#18181b';
      roughness = 0.18;
      metalness = 0.22;
    } else if (floorMatType === 'asphalt') {
      defaultColor = '#27272a';
      roughness = 0.88;
      metalness = 0.04;
    } else if (floorMatType === 'carpet_red') {
      defaultColor = '#7f1d1d';
      roughness = 0.92;
      metalness = 0.02;
    } else if (floorMatType === 'carpet_blue') {
      defaultColor = '#1e3a8a';
      roughness = 0.92;
      metalness = 0.02;
    } else if (floorMatType === 'marble') {
      defaultColor = '#f1f5f9';
      roughness = 0.12;
      metalness = 0.16;
    }

    const floorColor = t?.floorColor || defaultColor;
    const floorMat = new THREE.MeshStandardMaterial({
      color: floorColor,
      roughness,
      metalness
    });

    const floorGeo = new THREE.BoxGeometry(floor3DW, 2, floor3DD);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -1, OFFSET_3D_Z);
    floor.receiveShadow = true;
    archGroup.add(floor);

    // 4. Subtle Floor Boundary Accent Line
    const floorBorderGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(floor3DW, 2, floor3DD));
    const floorBorderMat = new THREE.LineBasicMaterial({ 
      color: preset === 'cyberpunk' ? '#10b981' : (preset === 'night_festival' ? '#ec4899' : '#a855f7'),
      linewidth: 2
    });
    const floorBorder = new THREE.LineSegments(floorBorderGeo, floorBorderMat);
    floorBorder.position.set(0, -0.9, OFFSET_3D_Z);
    archGroup.add(floorBorder);

    // 5. Floor Grid Overlay (if showGrid !== false)
    if (t?.showGrid !== false) {
      const gridHelper = new THREE.GridHelper(Math.max(floor3DW, floor3DD), 40, '#a855f7', 'rgba(255,255,255,0.06)');
      gridHelper.position.set(0, 0.02, OFFSET_3D_Z);
      archGroup.add(gridHelper);
    }

    // 6. Perimeter Walls / Fences
    if (wallVisible) {
      const wallThick = 4;
      const wallMat = new THREE.MeshStandardMaterial({
        color: wallColor,
        roughness: 0.7,
        metalness: 0.1
      });

      const halfW = floor3DW / 2;
      const halfD = floor3DD / 2;

      // Back Wall
      const backWall = new THREE.Mesh(new THREE.BoxGeometry(floor3DW + wallThick * 2, wallH, wallThick), wallMat);
      backWall.position.set(0, wallH / 2, -halfD + OFFSET_3D_Z - wallThick / 2);
      backWall.castShadow = true;
      backWall.receiveShadow = true;
      archGroup.add(backWall);

      // Front Barrier / Wall
      const frontWall = new THREE.Mesh(new THREE.BoxGeometry(floor3DW + wallThick * 2, Math.min(4, wallH), wallThick), wallMat);
      frontWall.position.set(0, Math.min(4, wallH) / 2, halfD + OFFSET_3D_Z + wallThick / 2);
      frontWall.receiveShadow = true;
      archGroup.add(frontWall);

      // Left Wall
      const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallH, floor3DD), wallMat);
      leftWall.position.set(-halfW - wallThick / 2, wallH / 2, OFFSET_3D_Z);
      leftWall.castShadow = true;
      leftWall.receiveShadow = true;
      archGroup.add(leftWall);

      // Right Wall
      const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallH, floor3DD), wallMat);
      rightWall.position.set(halfW + wallThick / 2, wallH / 2, OFFSET_3D_Z);
      rightWall.castShadow = true;
      rightWall.receiveShadow = true;
      archGroup.add(rightWall);
    } else {
      // Open-Air Low Sleek Barrier Posts & Neon Boundary
      const halfW = floor3DW / 2;
      const halfD = floor3DD / 2;
      const postGeo = new THREE.CylinderGeometry(0.5, 0.5, 3.5, 8);
      const postMat = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.8, roughness: 0.2 });

      // Place 4 corner light pillars
      const corners = [
        { x: -halfW, z: -halfD + OFFSET_3D_Z },
        { x: halfW, z: -halfD + OFFSET_3D_Z },
        { x: -halfW, z: halfD + OFFSET_3D_Z },
        { x: halfW, z: halfD + OFFSET_3D_Z }
      ];

      corners.forEach(c => {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(c.x, 1.75, c.z);
        archGroup.add(post);

        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.8, 12, 12),
          new THREE.MeshStandardMaterial({ 
            color: '#38bdf8', 
            emissive: '#38bdf8', 
            emissiveIntensity: 0.8 
          })
        );
        beacon.position.set(c.x, 3.8, c.z);
        archGroup.add(beacon);
      });
    }
  }, []);

  // 3D Object Dragging State
  const isDraggingObjectRef = useRef(false);
  const draggedElementIdRef = useRef<string | null>(null);
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const planeIntersectPoint = useRef(new THREE.Vector3());
  const dragOffsetRef = useRef({ x: 0, z: 0 });

  // Orbit, Pan & Multi-Touch State
  const isDraggingRef = useRef(false);
  const dragButtonRef = useRef<number>(0);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const pointerStartPos = useRef({ x: 0, y: 0 });
  const dragDistanceRef = useRef(0);

  // Active Multi-Touch pointers map for pinch zoom & 2-finger pan
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const initialPinchDistRef = useRef<number | null>(null);
  const initialRadiusRef = useRef<number>(145);
  const lastMidpointRef = useRef<{ x: number; y: number } | null>(null);

  // Smooth camera position and target
  const cameraTargetRef = useRef(new THREE.Vector3(0, 0, 8));
  const targetCameraTargetRef = useRef(new THREE.Vector3(0, 0, 8));
  
  // Spherical camera coordinates with clamping
  const sphericalRef = useRef({
    radius: 145,
    theta: 0.12,
    phi: Math.PI / 3.4
  });

  const targetSphericalRef = useRef({
    radius: 145,
    theta: 0.12,
    phi: Math.PI / 3.4
  });

  // Calculate prices
  const getElementPrice = useCallback((el: ChartElement | undefined, isVip?: boolean) => {
    if (!event) return undefined;
    const basePrice = (isVip || el?.priceType === 'vip') 
      ? Number(event.vipPrice || event.price || 0) 
      : Number(event.price || 0);
    return basePrice;
  }, [event]);

  // Create text texture helper
  const createTextTexture = (text: string, bgColor: string, textColor: string, width = 256, height = 128, fontSize = 48) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.roundRect(4, 4, width - 8, height - 8, 18);
      ctx.fill();

      ctx.strokeStyle = textColor;
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = textColor;
      ctx.fillText(text, width / 2, height / 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    return texture;
  };

  // Convert elements prop into 3D table defs
  const buildTableDefs = useCallback((): Table3DDef[] => {
    const tableElements = elements.filter(el => el.type === 'table');
    if (tableElements.length === 0 && elements.length === 0) {
      return ZOSYNA_3D_TABLES;
    }
    if (tableElements.length === 0) {
      return [];
    }

    const tw = territory?.width || 1200;
    const th = territory?.height || 800;

    return tableElements.map((el, index) => {
      const w2D = el.width || 60;
      const h2D = el.height || 40;
      const pos = get3DPosition(el.x, el.y, w2D, h2D, false, el.rotation || 0, tw, th);
      const width3D = Math.max(6, w2D * SCALE_X);
      const depth3D = Math.max(5, h2D * SCALE_Z);
      const isVip = el.priceType === 'vip' || (!el.priceType && el.type === 'table');
      const color = el.fill || (isVip ? '#eab308' : '#38bdf8');
      const chairs = el.seatsCount || 6;
      const shape = (el.radius || (chairs <= 5 && (!el.width || el.width === el.height))) ? 'round' : 'rect';
      const number = el.label?.replace(/[^0-9]/g, '') || el.label || (index + 1).toString();

      return {
        elementId: el.id,
        label: el.label || `Стіл ${number}`,
        number,
        zone: pos.x < -25 ? 'left' : pos.x > 25 ? 'right' : 'bottom',
        x: pos.x,
        z: pos.z,
        y: 0,
        width: width3D,
        depth: depth3D,
        shape,
        chairs,
        color,
        isVip,
        rotation: el.rotation || 0
      };
    });
  }, [elements, territory?.width, territory?.height]);

  // Main Scene Setup (Runs Once on Mount)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // --- 1. SCENE SETUP ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0c0d12');
    scene.fog = new THREE.FogExp2('#0c0d12', 0.0035);
    sceneRef.current = scene;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const camera = new THREE.PerspectiveCamera(40, width / height, 1, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // --- 2. LIGHTING RIG ---
    const ambientLight = new THREE.AmbientLight('#f8fafc', 1.45);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight('#fffbeb', 1.9);
    sunLight.position.set(60, 140, 80);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // Stage Spotlights
    const stageLight1 = new THREE.SpotLight('#a855f7', 9, 150, Math.PI / 4, 0.4, 1);
    stageLight1.position.set(-25, 45, -35);
    stageLight1.target.position.set(0, 0, -10);
    scene.add(stageLight1);
    scene.add(stageLight1.target);

    const stageLight2 = new THREE.SpotLight('#38bdf8', 9, 150, Math.PI / 4, 0.4, 1);
    stageLight2.position.set(25, 45, -35);
    stageLight2.target.position.set(0, 0, -10);
    scene.add(stageLight2);
    scene.add(stageLight2.target);

    // Purple Fan-zone Accent Light
    const fanGlow = new THREE.PointLight('#9333ea', 3.5, 90, 1.2);
    fanGlow.position.set(0, 15, 10);
    scene.add(fanGlow);

    // Hall Fill Lights
    const leftFill = new THREE.PointLight('#eab308', 2.2, 85, 1.2);
    leftFill.position.set(-50, 20, 10);
    scene.add(leftFill);

    const rightFill = new THREE.PointLight('#eab308', 2.2, 85, 1.2);
    rightFill.position.set(50, 20, 10);
    scene.add(rightFill);

    lightsRef.current = {
      ambient: ambientLight,
      sun: sunLight,
      spot1: stageLight1,
      spot2: stageLight2,
      fanGlow,
      leftFill,
      rightFill
    };

    // --- 3. ARCHITECTURE & FLOOR GROUP ---
    const architectureGroup = new THREE.Group();
    scene.add(architectureGroup);
    architectureGroupRef.current = architectureGroup;

    // Apply initial territory setup
    updateArchitectureAndLights(territory);

    // Dynamic Tables & Elements Container Group
    const tablesContainer = new THREE.Group();
    scene.add(tablesContainer);
    tablesContainerRef.current = tablesContainer;

    // --- 8. ANIMATION LOOP ---
    let animId: number;
    const clock = new THREE.Clock();

    const updateCamera = () => {
      const s = sphericalRef.current;
      const ts = targetSphericalRef.current;
      s.radius += (ts.radius - s.radius) * 0.12;
      s.theta += (ts.theta - s.theta) * 0.12;
      s.phi += (ts.phi - s.phi) * 0.12;

      const ct = cameraTargetRef.current;
      const tct = targetCameraTargetRef.current;
      ct.x += (tct.x - ct.x) * 0.14;
      ct.y += (tct.y - ct.y) * 0.14;
      ct.z += (tct.z - ct.z) * 0.14;

      const x = s.radius * Math.sin(s.phi) * Math.sin(s.theta);
      const y = s.radius * Math.cos(s.phi);
      const z = s.radius * Math.sin(s.phi) * Math.cos(s.theta);

      camera.position.set(
        x + ct.x,
        y + ct.y,
        z + ct.z
      );
      camera.lookAt(ct);
    };

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      interactiveMeshesRef.current.forEach((mesh) => {
        const halo = mesh.userData?.halo as THREE.Mesh | undefined;
        if (halo && mesh.userData?.elementId === selectedId) {
          halo.visible = true;
          (halo.material as THREE.MeshBasicMaterial).opacity = 0.7 + Math.sin(time * 6) * 0.3;
        } else if (halo) {
          halo.visible = false;
        }
      });

      updateCamera();
      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update architecture and lights whenever territory settings change
  useEffect(() => {
    updateArchitectureAndLights(territory);
  }, [territory, updateArchitectureAndLights]);

  // Rebuild / Update Dynamic 3D Elements when `elements`, `occupiedIds`, `selectedId` or `territory` changes
  useEffect(() => {
    const containerGroup = tablesContainerRef.current;
    if (!containerGroup) return;

    // Clear previous dynamic meshes
    while (containerGroup.children.length > 0) {
      containerGroup.remove(containerGroup.children[0]);
    }
    interactiveMeshesRef.current.clear();

    const isElementsEmpty = elements.length === 0;
    const effectiveElements = isElementsEmpty ? ZOSYNA_ELEMENTS : elements;
    const tw = territory?.width || 1200;
    const th = territory?.height || 800;

    // 1. Render Shapes & Stage
    const shapeElements = effectiveElements.filter(el => el.type === 'shape');
    shapeElements.forEach((shapeEl) => {
      const w2D = shapeEl.width || 320;
      const h2D = shapeEl.height || 110;
      const pos = get3DPosition(shapeEl.x, shapeEl.y, w2D, h2D, false, shapeEl.rotation || 0, tw, th);
      const width3D = Math.max(16, w2D * SCALE_X);
      const depth3D = Math.max(12, h2D * SCALE_Z);
      const isSelected = selectedId === shapeEl.id;
      const shapeColor = shapeEl.fill || '#27272a';
      const isStage = shapeEl.label?.toUpperCase().includes('СЦЕНА') || shapeEl.id.includes('stage');
      const rotRad = ((shapeEl.rotation || 0) * Math.PI) / 180;

      const shapeGroup = new THREE.Group();
      shapeGroup.position.set(pos.x, 0, pos.z);
      shapeGroup.rotation.y = -rotRad;

      if (isStage) {
        // Elevated Stage Platform
        const stageH = 3.8;
        const stageMesh = new THREE.Mesh(
          new THREE.BoxGeometry(width3D, stageH, depth3D),
          new THREE.MeshStandardMaterial({ color: shapeColor, roughness: 0.5, metalness: 0.2 })
        );
        stageMesh.position.y = stageH / 2;
        stageMesh.receiveShadow = true;
        stageMesh.castShadow = true;
        shapeGroup.add(stageMesh);

        // Stage Backdrop
        const stageBack = new THREE.Mesh(
          new THREE.BoxGeometry(width3D, 12, 1.2),
          new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.8 })
        );
        stageBack.position.set(0, 8, -depth3D / 2 + 0.6);
        shapeGroup.add(stageBack);

        // Truss Pillars
        const trussMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.8, roughness: 0.3 });
        const trussGeo = new THREE.CylinderGeometry(0.4, 0.4, 15, 8);

        const trussLeft = new THREE.Mesh(trussGeo, trussMat);
        trussLeft.position.set(-width3D / 2 + 2, 7.5, -depth3D / 2 + 1);
        shapeGroup.add(trussLeft);

        const trussRight = new THREE.Mesh(trussGeo, trussMat);
        trussRight.position.set(width3D / 2 - 2, 7.5, -depth3D / 2 + 1);
        shapeGroup.add(trussRight);

        const trussTop = new THREE.Mesh(new THREE.BoxGeometry(width3D - 2, 1.0, 1.0), trussMat);
        trussTop.position.set(0, 15, -depth3D / 2 + 1);
        shapeGroup.add(trussTop);

        // PA Speakers
        const speakerMat = new THREE.MeshStandardMaterial({ color: '#09090b', roughness: 0.4 });
        const speakerLeft = new THREE.Mesh(new THREE.BoxGeometry(3.2, 7, 3.2), speakerMat);
        speakerLeft.position.set(-width3D / 2 + 2.5, stageH + 3.5, depth3D / 2 - 2.5);
        shapeGroup.add(speakerLeft);

        const speakerRight = new THREE.Mesh(new THREE.BoxGeometry(3.2, 7, 3.2), speakerMat);
        speakerRight.position.set(width3D / 2 - 2.5, stageH + 3.5, depth3D / 2 - 2.5);
        shapeGroup.add(speakerRight);

        // Drumkit on stage (if stage is wide enough)
        if (width3D >= 20) {
          const bassDrum = new THREE.Mesh(
            new THREE.CylinderGeometry(2.4, 2.4, 2.4, 16),
            new THREE.MeshStandardMaterial({ color: '#0284c7', metalness: 0.5 })
          );
          bassDrum.rotation.z = Math.PI / 2;
          bassDrum.position.set(0, stageH + 2.4, -depth3D * 0.15);
          shapeGroup.add(bassDrum);
        }

        // Stage Front Frosted Sign
        const stageSignTex = createTextTexture(shapeEl.label || 'СЦЕНА', 'rgba(15, 23, 42, 0.85)', '#38bdf8', 512, 128, 64);
        const stageSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: stageSignTex, transparent: true }));
        stageSprite.scale.set(Math.min(24, Math.max(12, width3D * 0.4)), 4.2, 1);
        stageSprite.position.set(0, stageH + 3.2, depth3D / 2 + 0.5);
        shapeGroup.add(stageSprite);

        stageMesh.userData = {
          elementId: shapeEl.id,
          label: shapeEl.label || 'СЦЕНА',
          zone: 'stage',
          seats: 0,
          tableGroup: shapeGroup
        };
        interactiveMeshesRef.current.set(shapeEl.id, stageMesh);
      } else {
        // Custom Architectural Podium / Bar / Platform
        const boxH = 2.4;
        const boxMesh = new THREE.Mesh(
          new THREE.BoxGeometry(width3D, boxH, depth3D),
          new THREE.MeshStandardMaterial({ color: shapeColor, roughness: 0.4, metalness: 0.2 })
        );
        boxMesh.position.y = boxH / 2;
        boxMesh.receiveShadow = true;
        boxMesh.castShadow = true;
        shapeGroup.add(boxMesh);

        // Highlight outline
        const edgesGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(width3D, boxH, depth3D));
        const edgesMat = new THREE.LineBasicMaterial({ color: isSelected ? '#ffffff' : '#64748b' });
        const border = new THREE.LineSegments(edgesGeo, edgesMat);
        border.position.y = boxH / 2;
        shapeGroup.add(border);

        if (shapeEl.label) {
          const labelTex = createTextTexture(shapeEl.label, 'rgba(15, 23, 42, 0.85)', '#ffffff', 512, 128, 52);
          const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true }));
          labelSprite.scale.set(Math.min(20, width3D * 0.5), 4, 1);
          labelSprite.position.set(0, boxH + 2.5, 0);
          shapeGroup.add(labelSprite);
        }

        boxMesh.userData = {
          elementId: shapeEl.id,
          label: shapeEl.label || 'Блок',
          zone: 'hall',
          seats: 0,
          tableGroup: shapeGroup
        };
        interactiveMeshesRef.current.set(shapeEl.id, boxMesh);
      }

      containerGroup.add(shapeGroup);
    });

    // 2. Render Fanzones
    const fanElements = effectiveElements.filter(el => el.type === 'fanzone');
    fanElements.forEach((fanEl) => {
      const w2D = fanEl.width || 220;
      const h2D = fanEl.height || 110;
      const pos = get3DPosition(fanEl.x, fanEl.y, w2D, h2D, false, fanEl.rotation || 0, tw, th);
      const width3D = Math.max(16, w2D * SCALE_X);
      const depth3D = Math.max(12, h2D * SCALE_Z);
      const fanColor = fanEl.fill || '#9333ea';
      const isSelected = selectedId === fanEl.id;
      const rotRad = ((fanEl.rotation || 0) * Math.PI) / 180;

      const fanGroup = new THREE.Group();
      fanGroup.position.set(pos.x, 0.15, pos.z);
      fanGroup.rotation.y = -rotRad;

      const fanMat = new THREE.MeshStandardMaterial({
        color: fanColor,
        roughness: 0.35,
        metalness: 0.15,
        emissive: new THREE.Color(fanColor).multiplyScalar(0.2),
        emissiveIntensity: 0.25
      });

      const fanMesh = new THREE.Mesh(new THREE.BoxGeometry(width3D, 0.3, depth3D), fanMat);
      fanMesh.receiveShadow = true;
      fanMesh.castShadow = true;
      fanGroup.add(fanMesh);

      // Clean perimeter outline
      const fanEdgesGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(width3D, 0.3, depth3D));
      const fanBorderMat = new THREE.LineBasicMaterial({ 
        color: isSelected ? '#ffffff' : '#e9d5ff', 
        linewidth: isSelected ? 3 : 2 
      });
      const fanBorder = new THREE.LineSegments(fanEdgesGeo, fanBorderMat);
      fanBorder.position.y = 0.05;
      fanGroup.add(fanBorder);

      // Fan-Zone Glass Sign
      const fanLabel = fanEl.label || 'ФАН-ЗОНА';
      const fanTextTex = createTextTexture(fanLabel, fanColor, '#ffffff', 512, 128, 56);
      const fanSpriteMat = new THREE.SpriteMaterial({ map: fanTextTex, transparent: true });
      const fanSprite = new THREE.Sprite(fanSpriteMat);
      fanSprite.scale.set(Math.min(32, Math.max(14, width3D * 0.45)), 5.5, 1);
      fanSprite.position.set(0, 3.2, 0);
      fanGroup.add(fanSprite);

      fanMesh.userData = {
        elementId: fanEl.id,
        label: fanLabel,
        zone: 'fanzone',
        isFanzone: true,
        seats: 1,
        isVip: false,
        tableGroup: fanGroup
      };

      containerGroup.add(fanGroup);
      interactiveMeshesRef.current.set(fanEl.id, fanMesh);
    });

    // 3. Render Tables
    const tableDefs = buildTableDefs();

    tableDefs.forEach((tbl) => {
      const tableGroup = new THREE.Group();
      tableGroup.position.set(tbl.x, tbl.y || 0, tbl.z);
      if (tbl.rotation) {
        tableGroup.rotation.y = -((tbl.rotation * Math.PI) / 180);
      }

      const isOccupied = occupiedIds.includes(tbl.elementId);
      const isSelected = selectedId === tbl.elementId;

      const baseColor = isOccupied ? '#3f3f46' : (tbl.color || '#eab308');
      const tableMat = new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: isOccupied ? 0.6 : 0.28,
        metalness: isOccupied ? 0.1 : 0.35
      });

      let tableMesh: THREE.Mesh;
      if (tbl.shape === 'round') {
        const radius = tbl.width / 2;
        tableMesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 2.2, 24), tableMat);
        tableMesh.position.y = 2.6;
      } else {
        tableMesh = new THREE.Mesh(new THREE.BoxGeometry(tbl.width, 2.2, tbl.depth), tableMat);
        tableMesh.position.y = 2.6;
      }
      tableMesh.castShadow = true;
      tableMesh.receiveShadow = true;
      tableGroup.add(tableMesh);

      // Table Leg
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.8, 2.6, 12),
        new THREE.MeshStandardMaterial({ color: '#18181b', metalness: 0.5, roughness: 0.4 })
      );
      leg.position.y = 1.3;
      tableGroup.add(leg);

      // Chairs
      const chairMat = new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.6 });
      const chairGeo = new THREE.BoxGeometry(2.2, 0.5, 2.2);
      const chairBackGeo = new THREE.BoxGeometry(2.2, 2.4, 0.35);

      if (tbl.shape === 'round') {
        const chairCount = tbl.chairs || 4;
        const radDist = (tbl.width / 2) + 2.2;
        for (let i = 0; i < chairCount; i++) {
          const angle = (i / chairCount) * Math.PI * 2;
          const chairGroup = new THREE.Group();
          chairGroup.position.set(Math.cos(angle) * radDist, 1.3, Math.sin(angle) * radDist);
          chairGroup.rotation.y = -angle + Math.PI / 2;

          const seat = new THREE.Mesh(chairGeo, chairMat);
          chairGroup.add(seat);

          const back = new THREE.Mesh(chairBackGeo, chairMat);
          back.position.set(0, 1.4, 0.9);
          chairGroup.add(back);

          tableGroup.add(chairGroup);
        }
      } else {
        // Check horizontal vs vertical table layout
        const isHorizontal = tbl.width >= tbl.depth;
        const totalChairs = tbl.chairs || 4;

        if (isHorizontal) {
          const halfW = tbl.width / 2;
          const halfD = tbl.depth / 2 + 2.0;
          const countPerSide = Math.floor(totalChairs / 2);
          const remainder = totalChairs % 2;

          for (let i = 0; i < countPerSide; i++) {
            const offsetX = -halfW + (tbl.width / (countPerSide + 1)) * (i + 1);

            // North side (facing south)
            const chairNorth = new THREE.Group();
            chairNorth.position.set(offsetX, 1.3, -halfD);
            chairNorth.add(new THREE.Mesh(chairGeo, chairMat));
            const backN = new THREE.Mesh(chairBackGeo, chairMat);
            backN.position.set(0, 1.4, -0.9);
            chairNorth.add(backN);
            tableGroup.add(chairNorth);

            // South side (facing north)
            const chairSouth = new THREE.Group();
            chairSouth.position.set(offsetX, 1.3, halfD);
            chairSouth.add(new THREE.Mesh(chairGeo, chairMat));
            const backS = new THREE.Mesh(chairBackGeo, chairMat);
            backS.position.set(0, 1.4, 0.9);
            chairSouth.add(backS);
            tableGroup.add(chairSouth);
          }

          if (remainder > 0) {
            // Extra chair on West end
            const chairWest = new THREE.Group();
            chairWest.position.set(-halfW - 2.0, 1.3, 0);
            chairWest.rotation.y = -Math.PI / 2;
            chairWest.add(new THREE.Mesh(chairGeo, chairMat));
            const backW = new THREE.Mesh(chairBackGeo, chairMat);
            backW.position.set(0, 1.4, 0.9);
            chairWest.add(backW);
            tableGroup.add(chairWest);
          }
        } else {
          // Vertical table: long side along Z
          const halfW = tbl.width / 2 + 2.0;
          const halfD = tbl.depth / 2;
          const countPerSide = Math.floor(totalChairs / 2);
          const remainder = totalChairs % 2;

          for (let i = 0; i < countPerSide; i++) {
            const offsetZ = -halfD + (tbl.depth / (countPerSide + 1)) * (i + 1);

            // West side (facing east)
            const chairWest = new THREE.Group();
            chairWest.position.set(-halfW, 1.3, offsetZ);
            chairWest.rotation.y = -Math.PI / 2;
            chairWest.add(new THREE.Mesh(chairGeo, chairMat));
            const backW = new THREE.Mesh(chairBackGeo, chairMat);
            backW.position.set(0, 1.4, 0.9);
            chairWest.add(backW);
            tableGroup.add(chairWest);

            // East side (facing west)
            const chairEast = new THREE.Group();
            chairEast.position.set(halfW, 1.3, offsetZ);
            chairEast.rotation.y = Math.PI / 2;
            chairEast.add(new THREE.Mesh(chairGeo, chairMat));
            const backE = new THREE.Mesh(chairBackGeo, chairMat);
            backE.position.set(0, 1.4, 0.9);
            chairEast.add(backE);
            tableGroup.add(chairEast);
          }

          if (remainder > 0) {
            // Extra chair on North end
            const chairNorth = new THREE.Group();
            chairNorth.position.set(0, 1.3, -halfD - 2.0);
            chairNorth.add(new THREE.Mesh(chairGeo, chairMat));
            const backN = new THREE.Mesh(chairBackGeo, chairMat);
            backN.position.set(0, 1.4, -0.9);
            chairNorth.add(backN);
            tableGroup.add(chairNorth);
          }
        }
      }

      // VIP Number Tag on top of table
      const numTagTex = createTextTexture(
        tbl.number, 
        isOccupied ? '#3f3f46' : (tbl.color || '#eab308'), 
        '#000000', 
        128, 
        128, 
        76
      );
      const numSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: numTagTex, transparent: true }));
      numSprite.scale.set(3.4, 3.4, 1);
      numSprite.position.set(0, 4.4, 0);
      tableGroup.add(numSprite);

      // Selection Ring Mesh (Halo)
      const haloGeo = new THREE.RingGeometry(tbl.width * 0.6, tbl.width * 0.8, 32);
      const haloMat = new THREE.MeshBasicMaterial({ 
        color: '#ffffff', 
        side: THREE.DoubleSide, 
        transparent: true, 
        opacity: isSelected ? 0.95 : 0 
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.05;
      halo.name = 'halo';
      tableGroup.add(halo);

      tableMesh.userData = {
        elementId: tbl.elementId,
        label: tbl.label,
        number: tbl.number,
        zone: tbl.zone,
        seats: tbl.chairs,
        isVip: tbl.isVip,
        isOccupied,
        tableGroup,
        halo
      };

      containerGroup.add(tableGroup);
      interactiveMeshesRef.current.set(tbl.elementId, tableMesh);
    });

    // 4. Render Individual Seats
    const seatElements = effectiveElements.filter(el => el.type === 'seat');
    seatElements.forEach((seatEl) => {
      const pos = get3DPosition(seatEl.x, seatEl.y, 0, 0, true, seatEl.rotation || 0, tw, th);
      const isOccupied = occupiedIds.includes(seatEl.id);
      const isSelected = selectedId === seatEl.id;
      const isVip = seatEl.priceType === 'vip';
      const seatColor = isOccupied ? '#3f3f46' : (seatEl.fill || (isVip ? '#eab308' : '#38bdf8'));
      const rotRad = ((seatEl.rotation || 0) * Math.PI) / 180;

      const seatGroup = new THREE.Group();
      seatGroup.position.set(pos.x, 0, pos.z);
      seatGroup.rotation.y = -rotRad;

      const seatMat = new THREE.MeshStandardMaterial({
        color: seatColor,
        roughness: 0.35,
        metalness: 0.2
      });

      const chairMesh = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 3), seatMat);
      chairMesh.position.y = 1.2;
      chairMesh.castShadow = true;
      seatGroup.add(chairMesh);

      const backMesh = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 0.6), seatMat);
      backMesh.position.set(0, 2.7, 1.2);
      backMesh.castShadow = true;
      seatGroup.add(backMesh);

      // Label sprite
      const seatLabel = seatEl.label || '1';
      const seatTex = createTextTexture(seatLabel, seatColor, '#000000', 128, 128, 68);
      const numSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: seatTex, transparent: true }));
      numSprite.scale.set(2.4, 2.4, 1);
      numSprite.position.set(0, 4.8, 0);
      seatGroup.add(numSprite);

      // Selection Halo
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(2, 3.2, 24),
        new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, transparent: true, opacity: isSelected ? 0.9 : 0 })
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.05;
      halo.name = 'halo';
      seatGroup.add(halo);

      chairMesh.userData = {
        elementId: seatEl.id,
        label: seatLabel,
        zone: 'hall',
        seats: 1,
        isVip,
        isOccupied,
        tableGroup: seatGroup,
        halo
      };

      containerGroup.add(seatGroup);
      interactiveMeshesRef.current.set(seatEl.id, chairMesh);
    });

    // 5. Render Text Labels (Interactive in Editor & 3D)
    const textElements = effectiveElements.filter(el => el.type === 'text');
    textElements.forEach((txtEl) => {
      // If text is "СЦЕНА" and a stage shape already exists with "СЦЕНА", skip redundant text badge
      if (txtEl.label?.toUpperCase() === 'СЦЕНА' && shapeElements.some(s => s.label?.toUpperCase().includes('СЦЕНА'))) {
        return;
      }
      const pos = get3DPosition(txtEl.x, txtEl.y, 0, 0, true, txtEl.rotation || 0, tw, th);
      const txtColor = txtEl.fill || '#ffffff';
      const isSelected = selectedId === txtEl.id;
      const rotRad = ((txtEl.rotation || 0) * Math.PI) / 180;
      const bgColor = isSelected 
        ? 'rgba(147, 51, 234, 0.95)' 
        : (txtEl.label?.toUpperCase() === 'ВХІД' ? 'rgba(202, 138, 4, 0.9)' : 'rgba(15, 23, 42, 0.85)');
      
      const txtTex = createTextTexture(txtEl.label || 'ТЕКСТ', bgColor, txtColor, 512, 128, 56);
      const txtSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: txtTex, transparent: true }));
      const spriteW = Math.max(8, (txtEl.label?.length || 4) * 2.2);
      const spriteH = spriteW * 0.35;
      txtSprite.scale.set(spriteW, spriteH, 1);

      const textGroup = new THREE.Group();
      textGroup.position.set(pos.x, 3.5, pos.z);
      textGroup.rotation.y = -rotRad;
      textGroup.add(txtSprite);

      // Hitbox mesh for raycasting text selection & dragging
      const hitBox = new THREE.Mesh(
        new THREE.BoxGeometry(spriteW, spriteH, 2),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      textGroup.add(hitBox);

      // Selection halo on the floor below text
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(spriteW * 0.3, spriteW * 0.45, 24),
        new THREE.MeshBasicMaterial({ color: '#c084fc', side: THREE.DoubleSide, transparent: true, opacity: isSelected ? 0.9 : 0 })
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = -3.4;
      halo.name = 'halo';
      textGroup.add(halo);

      hitBox.userData = {
        elementId: txtEl.id,
        label: txtEl.label || 'ТЕКСТ',
        zone: 'text',
        seats: 0,
        isVip: false,
        tableGroup: textGroup,
        halo
      };

      containerGroup.add(textGroup);
      interactiveMeshesRef.current.set(txtEl.id, hitBox);
    });
  }, [elements, occupiedIds, selectedId, buildTableDefs, territory]);

  // Set Camera Presets
  const setViewPreset = (preset: 'iso' | 'top' | 'stage' | 'fanzone' | 'tables') => {
    setCameraView(preset);
    const ts = targetSphericalRef.current;
    const target = targetCameraTargetRef.current;

    switch (preset) {
      case 'iso':
        ts.radius = 145;
        ts.theta = 0.12;
        ts.phi = Math.PI / 3.4;
        target.set(0, 0, 8);
        break;
      case 'top':
        ts.radius = 150;
        ts.theta = 0;
        ts.phi = 0.05;
        target.set(0, 0, 10);
        break;
      case 'stage':
        ts.radius = 85;
        ts.theta = -0.05;
        ts.phi = Math.PI / 3.8;
        target.set(0, 4, -20);
        break;
      case 'fanzone':
        ts.radius = 95;
        ts.theta = 0.1;
        ts.phi = Math.PI / 3.2;
        target.set(0, 2, 10);
        break;
      case 'tables':
        ts.radius = 115;
        ts.theta = 0.35;
        ts.phi = Math.PI / 3.3;
        target.set(10, 0, 20);
        break;
    }
  };

  // Zoom controls
  const handleZoom = (delta: number) => {
    const ts = targetSphericalRef.current;
    ts.radius = Math.max(45, Math.min(240, ts.radius + delta));
  };

  // Manual Directional Pan Controls
  const panInDirection = (dirX: number, dirZ: number) => {
    if (!cameraRef.current) return;
    const target = targetCameraTargetRef.current;
    const s = sphericalRef.current;
    
    const sinT = Math.sin(s.theta);
    const cosT = Math.cos(s.theta);

    const rightX = cosT;
    const rightZ = -sinT;
    const forwardX = -sinT;
    const forwardZ = -cosT;

    const step = 16;
    target.x += (rightX * dirX + forwardX * dirZ) * step;
    target.z += (rightZ * dirX + forwardZ * dirZ) * step;
  };

  const resetTargetCenter = () => {
    targetCameraTargetRef.current.set(0, 0, 8);
    setViewPreset('iso');
  };

  // Event Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    isDraggingRef.current = true;
    dragButtonRef.current = e.button;
    previousMousePosition.current = { x: e.clientX, y: e.clientY };
    pointerStartPos.current = { x: e.clientX, y: e.clientY };
    dragDistanceRef.current = 0;

    const container = mountRef.current;
    if (editable && e.button === 0 && container && cameraRef.current) {
      const rect = container.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      const ndcX = (clientX / rect.width) * 2 - 1;
      const ndcY = -(clientY / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), cameraRef.current);
      const interactiveList = Array.from(interactiveMeshesRef.current.values());
      const intersects = raycaster.intersectObjects(interactiveList, true);

      if (intersects.length > 0) {
        let hitObj: THREE.Object3D | null = intersects[0].object;
        while (hitObj && !hitObj.userData?.elementId && hitObj.parent) {
          hitObj = hitObj.parent;
        }

        if (hitObj && hitObj.userData?.elementId) {
          const hitId = hitObj.userData.elementId;
          isDraggingObjectRef.current = true;
          draggedElementIdRef.current = hitId;

          // Compute floor plane intersection for precise drag offset
          if (raycaster.ray.intersectPlane(floorPlane, planeIntersectPoint.current)) {
            const tw = territory?.width || 1200;
            const th = territory?.height || 800;
            const el = elements.find(item => item.id === hitId);
            const isPoint = el?.type === 'seat' || el?.type === 'text';
            const cur3D = el 
              ? get3DPosition(el.x, el.y, el.width || 0, el.height || 0, isPoint, el.rotation || 0, tw, th) 
              : { x: hitObj.userData.tableGroup?.position.x || 0, z: hitObj.userData.tableGroup?.position.z || 0 };
            dragOffsetRef.current = {
              x: planeIntersectPoint.current.x - cur3D.x,
              z: planeIntersectPoint.current.z - cur3D.z
            };

            if (onSelect && el) {
              onSelect(el);
            }
          }
        }
      }
    }

    if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      initialPinchDistRef.current = dist;
      initialRadiusRef.current = targetSphericalRef.current.radius;
      lastMidpointRef.current = {
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const container = mountRef.current;
    if (!container || !cameraRef.current || !sceneRef.current) return;

    const rect = container.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    setMousePos({ x: clientX, y: clientY });

    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // If dragging an object in 3D edit mode
    if (isDraggingObjectRef.current && draggedElementIdRef.current && editable && onElementMove) {
      const ndcX = (clientX / rect.width) * 2 - 1;
      const ndcY = -(clientY / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), cameraRef.current);
      if (raycaster.ray.intersectPlane(floorPlane, planeIntersectPoint.current)) {
        const tw = territory?.width || 1200;
        const th = territory?.height || 800;
        const target3DX = planeIntersectPoint.current.x - dragOffsetRef.current.x;
        const target3DZ = planeIntersectPoint.current.z - dragOffsetRef.current.z;

        const el = elements.find(item => item.id === draggedElementIdRef.current);
        const isPoint = el?.type === 'seat' || el?.type === 'text';
        const new2D = get2DPositionFrom3D(target3DX, target3DZ, el?.width || 0, el?.height || 0, isPoint, el?.rotation || 0, tw, th);

        onElementMove(draggedElementIdRef.current, new2D.x, new2D.y);
      }
      return;
    }

    if (isDraggingRef.current) {
      if (activePointersRef.current.size >= 2) {
        const pts = Array.from(activePointersRef.current.values());
        const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const currentMid = {
          x: (pts[0].x + pts[1].x) / 2,
          y: (pts[0].y + pts[1].y) / 2
        };

        if (initialPinchDistRef.current && initialPinchDistRef.current > 0) {
          const ratio = initialPinchDistRef.current / Math.max(10, currentDist);
          targetSphericalRef.current.radius = Math.max(45, Math.min(240, initialRadiusRef.current * ratio));
        }

        if (lastMidpointRef.current) {
          const deltaMidX = currentMid.x - lastMidpointRef.current.x;
          const deltaMidY = currentMid.y - lastMidpointRef.current.y;
          dragDistanceRef.current += Math.hypot(deltaMidX, deltaMidY);

          const s = sphericalRef.current;
          const panSpeed = (s.radius / 140) * 0.22;

          const sinT = Math.sin(s.theta);
          const cosT = Math.cos(s.theta);

          const rightX = cosT;
          const rightZ = -sinT;
          const upX = sinT * Math.cos(s.phi);
          const upZ = cosT * Math.cos(s.phi);

          const target = targetCameraTargetRef.current;
          target.x -= (rightX * deltaMidX - upX * deltaMidY) * panSpeed;
          target.z -= (rightZ * deltaMidX - upZ * deltaMidY) * panSpeed;
        }

        lastMidpointRef.current = currentMid;
        previousMousePosition.current = { x: e.clientX, y: e.clientY };
        return;
      }

      const deltaX = e.clientX - previousMousePosition.current.x;
      const deltaY = e.clientY - previousMousePosition.current.y;
      dragDistanceRef.current += Math.hypot(deltaX, deltaY);

      const isRightClick = dragButtonRef.current === 2;
      const isMiddleClick = dragButtonRef.current === 1;
      const isShiftPan = e.shiftKey;
      const isPanMode = controlMode === 'pan';

      if (isRightClick || isMiddleClick || isShiftPan || isPanMode) {
        const s = sphericalRef.current;
        const panSpeed = (s.radius / 140) * 0.2;

        const sinT = Math.sin(s.theta);
        const cosT = Math.cos(s.theta);

        const rightX = cosT;
        const rightZ = -sinT;
        const upX = sinT * Math.cos(s.phi);
        const upZ = cosT * Math.cos(s.phi);

        const target = targetCameraTargetRef.current;
        target.x -= (rightX * deltaX - upX * deltaY) * panSpeed;
        target.z -= (rightZ * deltaX - upZ * deltaY) * panSpeed;
      } else {
        const ts = targetSphericalRef.current;
        ts.theta -= deltaX * 0.0075;
        ts.phi = Math.max(0.08, Math.min(1.38, ts.phi - deltaY * 0.0065));
      }

      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    } else {
      const ndcX = (clientX / rect.width) * 2 - 1;
      const ndcY = -(clientY / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), cameraRef.current);

      const interactiveList = Array.from(interactiveMeshesRef.current.values());
      const intersects = raycaster.intersectObjects(interactiveList, true);

      if (intersects.length > 0) {
        let hitObj: THREE.Object3D | null = intersects[0].object;
        while (hitObj && !hitObj.userData?.elementId && hitObj.parent) {
          hitObj = hitObj.parent;
        }

        if (hitObj && hitObj.userData?.elementId) {
          const udata = hitObj.userData;
          const chartEl = elements.find(el => el.id === udata.elementId);
          const isFanzone = udata.zone === 'fanzone' || udata.isFanzone || udata.elementId?.includes('fan');
          const isTable = udata.tableGroup !== undefined && (udata.seats > 0 || udata.zone === 'left' || udata.zone === 'right' || udata.zone === 'bottom');
          const isSeat = udata.zone === 'seat' || chartEl?.type === 'seat';
          const isArchitectural = !isFanzone && !isTable && !isSeat;

          // In booking / viewer mode, skip architectural shapes and text labels
          if (!editable && isArchitectural) {
            setHoveredElement(null);
            container.style.cursor = controlMode === 'pan' ? (isDraggingRef.current ? 'grabbing' : 'grab') : (isDraggingRef.current ? 'grabbing' : 'crosshair');
            return;
          }

          const price = getElementPrice(chartEl, udata.isVip);

          let zoneName = 'Зал';
          if (isFanzone) zoneName = 'Фан-зона';
          else if (udata.zone === 'left') zoneName = 'Лівий сектор';
          else if (udata.zone === 'right') zoneName = 'Правий сектор';
          else if (udata.zone === 'bottom') zoneName = 'Нижній сектор';
          else if (udata.zone === 'stage') zoneName = 'Сцена';

          setHoveredElement({
            id: udata.elementId,
            label: isFanzone ? 'ФАН-ЗОНА' : udata.label,
            zone: zoneName,
            isVip: (isFanzone || isArchitectural) ? false : udata.isVip,
            isFanzone,
            isArchitectural,
            seats: udata.seats || 0,
            price
          });

          container.style.cursor = (udata.isOccupied && !editable) ? 'not-allowed' : 'pointer';
          return;
        }
      }

      setHoveredElement(null);
      container.style.cursor = controlMode === 'pan' ? (isDraggingRef.current ? 'grabbing' : 'grab') : (isDraggingRef.current ? 'grabbing' : 'crosshair');
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    activePointersRef.current.delete(e.pointerId);

    isDraggingObjectRef.current = false;
    draggedElementIdRef.current = null;

    if (activePointersRef.current.size < 2) {
      initialPinchDistRef.current = null;
      lastMidpointRef.current = null;
    }

    if (activePointersRef.current.size === 0) {
      isDraggingRef.current = false;
    }
  };

  const handlePointerClick = (e: React.MouseEvent) => {
    if (readOnly && !editable) return;
    if (dragDistanceRef.current > 8) return;

    const container = mountRef.current;
    if (!container || !cameraRef.current || !sceneRef.current) return;

    const rect = container.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const ndcX = (clientX / rect.width) * 2 - 1;
    const ndcY = -(clientY / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), cameraRef.current);

    const interactiveList = Array.from(interactiveMeshesRef.current.values());
    const intersects = raycaster.intersectObjects(interactiveList, true);

    if (intersects.length > 0) {
      let hitObj: THREE.Object3D | null = intersects[0].object;
      while (hitObj && !hitObj.userData?.elementId && hitObj.parent) {
        hitObj = hitObj.parent;
      }

      if (hitObj && hitObj.userData?.elementId) {
        const udata = hitObj.userData;
        if (udata.isOccupied && !editable) return;

        const isFanzone = udata.zone === 'fanzone' || udata.isFanzone || udata.elementId?.includes('fan');
        const isTable = udata.tableGroup !== undefined && (udata.seats > 0 || udata.zone === 'left' || udata.zone === 'right' || udata.zone === 'bottom');
        const isSeat = udata.zone === 'seat';
        const isArchitectural = !isFanzone && !isTable && !isSeat;

        if (!editable && isArchitectural) {
          return;
        }

        const matchedEl = elements.find(el => el.id === udata.elementId) || {
          id: udata.elementId,
          type: isFanzone ? 'fanzone' : 'table',
          x: (udata.tableGroup?.position.x / 0.17) + 550 || 500,
          y: (udata.tableGroup?.position.z / 0.15) + 380 || 400,
          label: udata.label,
          priceType: udata.isVip ? 'vip' : 'standard',
          seatsCount: udata.seats,
          sellAsWhole: true
        } as ChartElement;

        if (onSelect) {
          onSelect(matchedEl, 1);
        }
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    handleZoom(e.deltaY * 0.08);
  };

  return (
    <div className={cn("relative w-full h-full select-none overflow-hidden bg-[#0c0d12] touch-none", className)}>
      {/* 3D Canvas Mount Point */}
      <div 
        ref={mountRef} 
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handlePointerClick}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-full touch-none"
      />

      {/* Top Floating View Controls & Presets */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none z-10">
        {/* Preset Camera Views */}
        <div className="flex items-center gap-1 sm:gap-1.5 bg-zinc-950/85 backdrop-blur-md p-1 sm:p-1.5 rounded-2xl border border-white/10 shadow-xl pointer-events-auto overflow-x-auto max-w-[calc(100%-110px)] sm:max-w-none scrollbar-none">
          <button
            onClick={() => setViewPreset('iso')}
            className={cn(
              "px-2.5 sm:px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap active:scale-95",
              cameraView === 'iso' ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30" : "text-zinc-400 hover:text-white"
            )}
          >
            3D Огляд
          </button>
          <button
            onClick={() => setViewPreset('top')}
            className={cn(
              "px-2.5 sm:px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap active:scale-95",
              cameraView === 'top' ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30" : "text-zinc-400 hover:text-white"
            )}
          >
            Зверху (2D)
          </button>
          <button
            onClick={() => setViewPreset('stage')}
            className={cn(
              "px-2.5 sm:px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap active:scale-95",
              cameraView === 'stage' ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30" : "text-zinc-400 hover:text-white"
            )}
          >
            Сцена
          </button>
          <button
            onClick={() => setViewPreset('fanzone')}
            className={cn(
              "px-2.5 sm:px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap active:scale-95",
              cameraView === 'fanzone' ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30" : "text-zinc-400 hover:text-white"
            )}
          >
            Фан-зона
          </button>
          <button
            onClick={() => setViewPreset('tables')}
            className={cn(
              "px-2.5 sm:px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap active:scale-95",
              cameraView === 'tables' ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30" : "text-zinc-400 hover:text-white"
            )}
          >
            Столи VIP
          </button>
        </div>

        {/* Orbit / Pan Mode Switcher */}
        <div className="flex items-center gap-1 bg-zinc-950/85 backdrop-blur-md p-1 rounded-2xl border border-white/10 shadow-xl pointer-events-auto shrink-0">
          <button
            onClick={() => setControlMode('orbit')}
            className={cn(
              "p-2 rounded-xl text-xs font-bold transition-all active:scale-95",
              controlMode === 'orbit' ? "bg-purple-600 text-white shadow-md" : "text-zinc-400 hover:text-white"
            )}
            title="Обертання сцени (1 палець)"
          >
            <Orbit size={16} />
          </button>
          <button
            onClick={() => setControlMode('pan')}
            className={cn(
              "p-2 rounded-xl text-xs font-bold transition-all active:scale-95",
              controlMode === 'pan' ? "bg-purple-600 text-white shadow-md" : "text-zinc-400 hover:text-white"
            )}
            title="Переміщення сцени"
          >
            <Move size={16} />
          </button>
        </div>
      </div>

      {/* Floating Zoom & Pan Controls on Right */}
      <div className="absolute right-3 bottom-4 flex flex-col gap-2 z-10 pointer-events-auto">
        <button
          onClick={() => handleZoom(-20)}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-zinc-950/85 hover:bg-zinc-800 text-white border border-white/10 flex items-center justify-center shadow-2xl transition-all active:scale-95"
          title="Наблизити"
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={() => handleZoom(20)}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-zinc-950/85 hover:bg-zinc-800 text-white border border-white/10 flex items-center justify-center shadow-2xl transition-all active:scale-95"
          title="Віддалити"
        >
          <ZoomOut size={18} />
        </button>
        <button
          onClick={resetTargetCenter}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-zinc-950/85 hover:bg-zinc-800 text-white border border-white/10 flex items-center justify-center shadow-2xl transition-all active:scale-95"
          title="Скинути камеру"
        >
          <RotateCcw size={18} />
        </button>
      </div>

      {/* D-Pad Directional Pan Controls on Left */}
      <div className="absolute left-3 bottom-4 hidden sm:flex flex-col items-center bg-zinc-950/85 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 shadow-2xl z-10 pointer-events-auto">
        <button
          onClick={() => panInDirection(0, 1)}
          className="w-8 h-8 rounded-xl hover:bg-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition-colors active:scale-90"
          title="Перемістити вперед"
        >
          <ArrowUp size={16} />
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => panInDirection(-1, 0)}
            className="w-8 h-8 rounded-xl hover:bg-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition-colors active:scale-90"
            title="Перемістити вліво"
          >
            <ArrowLeft size={16} />
          </button>
          <button
            onClick={resetTargetCenter}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-[9px] font-black text-zinc-400 hover:text-white transition-colors"
            title="Центрувати"
          >
            CTR
          </button>
          <button
            onClick={() => panInDirection(1, 0)}
            className="w-8 h-8 rounded-xl hover:bg-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition-colors active:scale-90"
            title="Перемістити вправо"
          >
            <ArrowRight size={16} />
          </button>
        </div>
        <button
          onClick={() => panInDirection(0, -1)}
          className="w-8 h-8 rounded-xl hover:bg-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition-colors active:scale-90"
          title="Перемістити назад"
        >
          <ArrowDown size={16} />
        </button>
      </div>

      {/* Hover Info Tooltip (Desktop) */}
      <AnimatePresence>
        {hoveredElement && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              left: Math.min(window.innerWidth - 240, Math.max(16, mousePos.x + 16)),
              top: Math.min(window.innerHeight - 120, Math.max(16, mousePos.y - 48)),
              pointerEvents: 'none'
            }}
            className={cn(
              "z-50 bg-zinc-950/95 backdrop-blur-xl p-3 rounded-2xl shadow-2xl space-y-1.5 min-w-[160px] border",
              hoveredElement.isFanzone 
                ? "border-purple-500/40 shadow-purple-500/10" 
                : "border-yellow-500/40 shadow-yellow-500/10"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                {hoveredElement.zone}
              </span>
              {hoveredElement.isFanzone ? (
                <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[8px] font-black uppercase tracking-widest border border-purple-500/30 flex items-center gap-1">
                  <Sparkles size={9} /> FAN
                </span>
              ) : hoveredElement.isVip ? (
                <span className="px-2 py-0.5 rounded-md bg-yellow-500/20 text-yellow-400 text-[8px] font-black uppercase tracking-widest border border-yellow-500/30 flex items-center gap-1">
                  <Crown size={9} /> VIP
                </span>
              ) : null}
            </div>
            <p className="text-sm font-black text-white">{hoveredElement.label}</p>
            {(!hoveredElement.isArchitectural || hoveredElement.price !== undefined) && (
              <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-white/5 font-bold">
                {hoveredElement.isFanzone ? (
                  <div className="w-full flex items-center justify-between">
                    <span className="text-zinc-400 text-[10px]">Ціна за 1 квиток:</span>
                    {hoveredElement.price !== undefined && (
                      <span className="text-green-400 font-black font-mono">{hoveredElement.price} грн</span>
                    )}
                  </div>
                ) : hoveredElement.seats > 0 ? (
                  <>
                    <span className="text-zinc-400 text-[10px]">Місць: {hoveredElement.seats}</span>
                    {hoveredElement.price !== undefined && (
                      <span className="text-green-400 font-black font-mono">{hoveredElement.price} грн</span>
                    )}
                  </>
                ) : null}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
