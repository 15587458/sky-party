import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Circle, Rect, Text, Group, Transformer, Image } from 'react-konva';
import useImage from 'use-image';
import { ChartElement } from '../types';

interface SeatingChartCanvasProps {
  elements: ChartElement[];
  backgroundImage?: string;
  onUpdate?: (elements: ChartElement[]) => void;
  onSelect?: (id: string | null) => void;
  selectedId?: string | null;
  isAdmin?: boolean;
  occupiedIds?: string[];
  width?: number;
  height?: number;
  scale?: number;
  onScaleChange?: (scale: number) => void;
  isSelectableAll?: boolean;
}

const GRID_SIZE = 20;

const BackgroundImage = ({ url, width, height }: { url: string, width: number, height: number }) => {
  const [image] = useImage(url);
  if (!image) return null;
  
  // Calculate best fit
  const imgWidth = image.width;
  const imgHeight = image.height;
  const ratio = Math.min(width / imgWidth, height / imgHeight);
  
  return (
    <Image 
      image={image} 
      width={imgWidth * ratio} 
      height={imgHeight * ratio}
      opacity={0.3}
      listening={false}
    />
  );
};

export default function SeatingChartCanvas({
  elements,
  backgroundImage,
  onUpdate,
  onSelect,
  selectedId,
  isAdmin = false,
  occupiedIds = [],
  width = 800,
  height = 600,
  scale = 1,
  onScaleChange,
  isSelectableAll = false
}: SeatingChartCanvasProps) {
  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isAdmin || !selectedId) return;
      
      const el = elements.find(item => item.id === selectedId);
      if (!el) return;

      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;

      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      let newX = el.x;
      let newY = el.y;

      if (e.key === 'ArrowLeft') newX -= step;
      if (e.key === 'ArrowRight') newX += step;
      if (e.key === 'ArrowUp') newY -= step;
      if (e.key === 'ArrowDown') newY += step;

      if (newX !== el.x || newY !== el.y) {
        onUpdate?.(elements.map(item => 
          item.id === selectedId ? { ...item, x: newX, y: newY } : item
        ));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdmin, selectedId, elements, onUpdate]);

  const handleWheel = (e: any) => {
    if (isAdmin) return;
    const scaleBy = 1.1;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const mousePointTo = {
      x: stage.getPointerPosition().x / oldScale - stage.x() / oldScale,
      y: stage.getPointerPosition().y / oldScale - stage.y() / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const finalScale = Math.max(0.2, Math.min(newScale, 5));
    
    if (onScaleChange) {
      onScaleChange(finalScale);
    }
  };

  useEffect(() => {
    if (isAdmin && transformerRef.current && selectedId) {
      const selectedNode = stageRef.current.findOne('#' + selectedId);
      if (selectedNode) {
        transformerRef.current.nodes([selectedNode]);
        transformerRef.current.getLayer().batchDraw();
      } else {
        transformerRef.current.nodes([]);
      }
    }
  }, [selectedId, isAdmin]);

  const handleDragEnd = (e: any, id: string) => {
    if (!isAdmin || !onUpdate) return;
    const el = elements.find(item => item.id === id);
    const snap = el?.parentId ? GRID_SIZE / 4 : GRID_SIZE;
    
    const newElements = elements.map(item => {
      if (item.id === id) {
        return {
          ...item,
          x: Math.round(e.target.x() / snap) * snap,
          y: Math.round(e.target.y() / snap) * snap
        };
      }
      return item;
    });
    onUpdate(newElements);
  };

  const handleTransformEnd = (e: any, id: string) => {
    if (!isAdmin || !onUpdate) return;
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scale to avoid stretching issues in future transforms
    node.scaleX(1);
    node.scaleY(1);

    const newElements = elements.map(el => {
      if (el.id === id) {
        const updated = { ...el, x: node.x(), y: node.y() };
        if (el.type === 'shape' || el.type === 'table' || el.type === 'fanzone') {
          updated.width = Math.max(5, node.width() * scaleX);
          updated.height = Math.max(5, node.height() * scaleY);
        }
        if (el.radius) {
          updated.radius = Math.max(5, el.radius * scaleX);
        }
        updated.rotation = node.rotation();
        return updated;
      }
      return el;
    });
    onUpdate(newElements);
  };

  const renderElement = (el: ChartElement) => {
    const isOccupied = ((el.type === 'seat' || (el.type === 'table' && el.sellAsWhole)) && occupiedIds.includes(el.id)) || el.isBlocked;
    const isSelected = selectedId === el.id;

    let color = el.fill || '#3f3f46'; // fallback to custom fill or default zinc-700
    if (!el.fill) {
      if (el.priceType === 'vip') color = '#a855f7'; // neon-purple
      if (el.priceType === 'standard') color = '#71717a'; // zinc-500
    }
    if (isOccupied) color = el.isBlocked ? '#ef4444' : '#e4e4e7'; // Red if blocked, Light Gray if occupied
    if (isSelected) color = '#000000'; // Pure black if selected

    const commonProps = {
      id: el.id,
      x: el.x,
      y: el.y,
      draggable: isAdmin,
      onClick: () => el.type !== 'text' && (!isOccupied || isAdmin || isSelectableAll) && onSelect?.(el.id),
      onTap: () => el.type !== 'text' && (!isOccupied || isAdmin || isSelectableAll) && onSelect?.(el.id),
      onDragEnd: (e: any) => handleDragEnd(e, el.id),
      onTransformEnd: (e: any) => handleTransformEnd(e, el.id),
      opacity: el.type === 'fanzone' ? 0.3 : 1,
      stroke: isSelected ? '#a855f7' : color,
      strokeWidth: isSelected ? 3 : (el.type === 'fanzone' ? 1 : 0),
      rotation: el.rotation || 0,
      listening: el.type === 'text' ? isAdmin : (!isOccupied || isAdmin || isSelectableAll),
    };

    switch (el.type) {
      case 'seat':
        // If it's a child seat, its coordinates are relative to the parent group
        const seatX = el.parentId ? el.x : el.x;
        const seatY = el.parentId ? el.y : el.y;
        
        return (
          <Group 
            key={el.id} 
            id={el.id}
            x={seatX} 
            y={seatY} 
            draggable={isAdmin} 
            onClick={(e) => {
              e.cancelBubble = true;
              onSelect?.(el.id);
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              onSelect?.(el.id);
            }}
            onDragEnd={(e) => handleDragEnd(e, el.id)}
            listening={!isOccupied || isAdmin || isSelectableAll}
          >
            <Circle
              radius={el.radius || 15}
              fill={isOccupied ? '#e4e4e7' : color}
              stroke={isSelected ? '#a855f7' : (isOccupied ? '#d4d4d8' : 'none')}
              strokeWidth={isSelected ? 3 : 2}
            />
            <Text
              text={el.label || ''}
              fontSize={10}
              fontStyle="bold"
              fill={isOccupied ? '#a1a1aa' : (el.priceType === 'vip' || isSelected ? '#ffffff' : '#000000')}
              align="center"
              verticalAlign="middle"
              offsetX={5}
              offsetY={5}
              listening={false}
            />
          </Group>
        );

      case 'table':
        const isTableSelectable = isAdmin || el.sellAsWhole || isSelectableAll;
        const seatsCount = el.seatsCount || 0;
        const childSeats = elements.filter(child => child.parentId === el.id);
        
        let width = el.width || 60;
        let height = el.height || 60;

        // Auto-rectangular for 8 seats if not already adjusted
        if (seatsCount === 8 && width === height) {
          width = 120;
          height = 60;
        }
        
        // Static seats (generated)
        const staticSeats = [];
        if (seatsCount > 0 && childSeats.length === 0) {
          if (seatsCount === 4) {
            // 2 on Top, 2 on Bottom
            for (let i = 0; i < 2; i++) {
              const tx = (width / 2) * (i + 0.5);
              [[tx, -15], [tx, height + 15]].forEach(([sx, sy], idx) => {
                staticSeats.push(
                  <Circle
                    key={`seat-${el.id}-${i}-${idx}`}
                    x={sx}
                    y={sy}
                    radius={8}
                    fill={isOccupied ? '#111' : (el.priceType === 'vip' ? '#a855f7' : '#71717a')}
                    opacity={0.6}
                    stroke="#333"
                    strokeWidth={1}
                  />
                );
              });
            }
          } else if (seatsCount === 5) {
            // 2 on Top, 2 on Bottom, 1 on Left
            for (let i = 0; i < 2; i++) {
              const tx = (width / 2) * (i + 0.5);
              [[tx, -15], [tx, height + 15]].forEach(([sx, sy], idx) => {
                staticSeats.push(
                  <Circle
                    key={`seat-${el.id}-${i}-${idx}`}
                    x={sx}
                    y={sy}
                    radius={8}
                    fill={isOccupied ? '#111' : (el.priceType === 'vip' ? '#a855f7' : '#71717a')}
                    opacity={0.6}
                    stroke="#333"
                    strokeWidth={1}
                  />
                );
              });
            }
            staticSeats.push(
              <Circle
                key={`seat-${el.id}-side`}
                x={-15}
                y={height / 2}
                radius={8}
                fill={isOccupied ? '#111' : (el.priceType === 'vip' ? '#a855f7' : '#71717a')}
                opacity={0.6}
                stroke="#333"
                strokeWidth={1}
              />
            );
          } else if (seatsCount === 8) {
            // 4 on Top, 4 on Bottom
            for (let i = 0; i < 4; i++) {
              const tx = (width / 4) * (i + 0.5);
              [[tx, -15], [tx, height + 15]].forEach(([sx, sy], idx) => {
                staticSeats.push(
                  <Circle
                    key={`seat-${el.id}-${i}-${idx}`}
                    x={sx}
                    y={sy}
                    radius={8}
                    fill={isOccupied ? '#111' : (el.priceType === 'vip' ? '#a855f7' : '#71717a')}
                    opacity={0.6}
                    stroke="#333"
                    strokeWidth={1}
                  />
                );
              });
            }
          } else {
            // Original circular logic for other counts
            const radiusX = width / 2 + 15;
            const radiusY = height / 2 + 15;
            for (let i = 0; i < seatsCount; i++) {
              const angle = (i / seatsCount) * 2 * Math.PI;
              const sx = width / 2 + radiusX * Math.cos(angle);
              const sy = height / 2 + radiusY * Math.sin(angle);
              staticSeats.push(
                <Circle
                  key={`seat-${el.id}-${i}`}
                  x={sx}
                  y={sy}
                  radius={8}
                  fill={isOccupied ? '#111' : (el.priceType === 'vip' ? '#a855f7' : '#71717a')}
                  opacity={0.6}
                  stroke="#333"
                  strokeWidth={1}
                />
              );
            }
          }
        }

        return (
          <Group key={el.id} x={el.x} y={el.y} draggable={isAdmin}
            id={el.id}
            onClick={() => isTableSelectable && onSelect?.(el.id)} onTap={() => isTableSelectable && onSelect?.(el.id)}
            onDragEnd={(e) => handleDragEnd(e, el.id)}
            onTransformEnd={(e) => handleTransformEnd(e, el.id)}
            listening={isTableSelectable}
            rotation={el.rotation || 0}
          >
            {staticSeats}
            {childSeats.map(child => renderElement(child))}
            <Rect
              width={width}
              height={height}
              fill={color}
              cornerRadius={10}
              opacity={isOccupied ? 0.3 : 0.8}
              stroke={isSelected ? '#a855f7' : 'none'}
              strokeWidth={isSelected ? 3 : 2}
            />
            <Text
              text={el.label || 'T'}
              fontSize={12}
              fontStyle="bold"
              fill={isOccupied ? '#8e8e93' : (el.priceType === 'vip' ? '#fff' : '#000')}
              width={width}
              height={height}
              align="center"
              verticalAlign="middle"
              listening={false}
            />
          </Group>
        );

      case 'fanzone':
        return (
          <Rect
            key={el.id}
            {...commonProps}
            width={el.width || 100}
            height={el.height || 100}
            fill={color}
            dash={[5, 5]}
            label={el.label}
          />
        );

      case 'text':
        return (
          <Text
            key={el.id}
            {...commonProps}
            text={el.label || 'Text'}
            fontSize={el.radius || 20}
            fill="#09090b"
            fontStyle="bold"
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="relative bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-xs">
      <Stage
        width={width}
        height={height}
        ref={stageRef}
        scaleX={scale}
        scaleY={scale}
        draggable={!isAdmin}
        onWheel={handleWheel}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) {
            onSelect?.(null);
          }
        }}
      >
        <Layer>
          {backgroundImage && <BackgroundImage url={backgroundImage} width={width} height={height} />}
          
          {/* Grid Background */}
          {isAdmin && Array.from({ length: Math.ceil(width / GRID_SIZE) }).map((_, i) => (
            <Rect
               key={`v-${i}`}
               x={i * GRID_SIZE}
               y={0}
               width={1}
               height={height}
               fill="rgba(255,255,255,0.02)"
            />
          ))}
          {isAdmin && Array.from({ length: Math.ceil(height / GRID_SIZE) }).map((_, i) => (
            <Rect
               key={`h-${i}`}
               x={0}
               y={i * GRID_SIZE}
               width={width}
               height={1}
               fill="rgba(255,255,255,0.02)"
            />
          ))}

          {elements.filter(el => !el.parentId).map(el => renderElement(el))}
          
          {isAdmin && <Transformer ref={transformerRef} rotateEnabled keepRatio={false} />}
        </Layer>
      </Stage>
      
      {!isAdmin && elements.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-white/20 font-black uppercase tracking-widest text-xs">
          Схема залу відсутня
        </div>
      )}
    </div>
  );
}
