import { useEffect, useRef, useState, useCallback } from 'react';
import type { Paper } from '@/types';

interface LinkGraphNode {
  id: number;
  title: string;
  filePath: string;
}

interface LinkGraphEdge {
  source: string;
  target: string;
}

interface LinkGraph {
  nodes: LinkGraphNode[];
  links: LinkGraphEdge[];
}

interface GraphViewProps {
  papers: Paper[];
  onNavigate: (paper: Paper) => void;
}

interface SimNode {
  id: number;
  title: string;
  filePath: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  degree: number;
  fixed: boolean;
}

interface SimEdge {
  source: number;
  target: number;
}

const K_REPEL = 5000;
const K_ATTRACT = 0.01;
const IDEAL_LEN = 150;
const K_CENTER = 0.001;
const DAMPING = 0.9;
const MAX_SPEED = 5;
const ENERGY_THRESHOLD = 0.1;
const LABEL_MAX = 12;

function colorForDegree(accent: string, degree: number): string {
  const m = accent.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
  if (!m) return accent;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  const t = Math.min(1, (degree - 1) / 4);
  const mix = (c: number) => Math.round(c + (255 - c) * (1 - t) * 0.6);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export function GraphView({ papers, onNavigate }: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const nodesRef = useRef<SimNode[]>([]);
  const edgesRef = useRef<SimEdge[]>([]);
  const rafRef = useRef<number>(0);
  const runningRef = useRef(false);
  const zoomRef = useRef(1.0);
  const panRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{ nodeIdx: number; moved: boolean } | null>(null);
  const panningRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const hoveredRef = useRef<SimNode | null>(null);

  const [loading, setLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const worldFromEvent = useCallback(
    (e: { clientX: number; clientY: number }): { wx: number; wy: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      return {
        wx: (sx - panRef.current.x) / zoomRef.current,
        wy: (sy - panRef.current.y) / zoomRef.current,
      };
    },
    [],
  );

  const findNodeAt = useCallback((wx: number, wy: number): number | null => {
    const nodes = nodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const dx = wx - nodes[i].x;
      const dy = wy - nodes[i].y;
      if (dx * dx + dy * dy <= (nodes[i].radius + 6) * (nodes[i].radius + 6)) {
        return i;
      }
    }
    return null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const graph: LinkGraph = await window.electronAPI.getLinkGraph();
        if (cancelled) return;

        const titleToIdx = new Map<string, number>();
        graph.nodes.forEach((n, i) => titleToIdx.set(n.title, i));

        const degrees = new Array(graph.nodes.length).fill(0);
        for (const link of graph.links) {
          const si = titleToIdx.get(link.source);
          const ti = titleToIdx.get(link.target);
          if (si !== undefined) degrees[si]++;
          if (ti !== undefined) degrees[ti]++;
        }

        const maxDeg = Math.max(1, ...degrees);

        const simNodes: SimNode[] = graph.nodes.map((n, i) => ({
          id: n.id,
          title: n.title,
          filePath: n.filePath,
          x: (Math.random() - 0.5) * 400,
          y: (Math.random() - 0.5) * 400,
          vx: 0,
          vy: 0,
          radius: 8 + (degrees[i] / maxDeg) * 12,
          degree: degrees[i],
          fixed: false,
        }));

        const simEdges: SimEdge[] = [];
        for (const link of graph.links) {
          const si = titleToIdx.get(link.source);
          const ti = titleToIdx.get(link.target);
          if (si !== undefined && ti !== undefined) {
            simEdges.push({ source: si, target: ti });
          }
        }

        nodesRef.current = simNodes;
        edgesRef.current = simEdges;
        setDataReady(true);
      } catch {
        if (!cancelled) setLoading(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!dataReady) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
    };

    resizeCanvas();
    runningRef.current = true;

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(container);

    function physicsStep(): number {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const rect = container!.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const f = K_REPEL / (dist * dist);
          const fx = (dx / dist) * f;
          const fy = (dy / dist) * f;
          nodes[i].vx += fx;
          nodes[i].vy += fy;
          nodes[j].vx -= fx;
          nodes[j].vy -= fy;
        }
      }

      for (const edge of edges) {
        const s = nodes[edge.source];
        const t = nodes[edge.target];
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = K_ATTRACT * (dist - IDEAL_LEN);
        const fx = (dx / dist) * f;
        const fy = (dy / dist) * f;
        s.vx += fx;
        s.vy += fy;
        t.vx -= fx;
        t.vy -= fy;
      }

      let energy = 0;

      for (const node of nodes) {
        if (node.fixed) {
          node.vx = 0;
          node.vy = 0;
          continue;
        }

        node.vx += (cx - node.x) * K_CENTER;
        node.vy += (cy - node.y) * K_CENTER;

        node.vx *= DAMPING;
        node.vy *= DAMPING;

        const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        if (speed > MAX_SPEED) {
          node.vx = (node.vx / speed) * MAX_SPEED;
          node.vy = (node.vy / speed) * MAX_SPEED;
        }

        node.x += node.vx;
        node.y += node.vy;

        energy += node.vx * node.vx + node.vy * node.vy;
      }

      return energy;
    }

    function render() {
      if (!ctx) return;

      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const hovered = hoveredRef.current;
      const zoom = zoomRef.current;
      const px = panRef.current.x;
      const py = panRef.current.y;
      const dpr = window.devicePixelRatio || 1;
      const rect = container!.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      const style = getComputedStyle(document.documentElement);
      const borderColor = style.getPropertyValue('--border').trim() || '#d0d7de';
      const textColor = style.getPropertyValue('--text-primary').trim() || '#1f2328';
      const accentColor = style.getPropertyValue('--accent').trim() || '#4A90D9';

      ctx.save();
      ctx.clearRect(0, 0, w * dpr, h * dpr);
      ctx.scale(dpr, dpr);
      ctx.translate(px, py);
      ctx.scale(zoom, zoom);

      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1 / zoom;
      for (const edge of edges) {
        const s = nodes[edge.source];
        const t = nodes[edge.target];
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
      }

      for (const node of nodes) {
        const isHovered = hovered?.id === node.id;
        const r = isHovered ? node.radius * 1.3 : node.radius;
        const fill = isHovered ? accentColor : colorForDegree(accentColor, node.degree);

        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();

        const truncated = node.title.length > LABEL_MAX
          ? node.title.slice(0, LABEL_MAX) + '…'
          : node.title;
        const label = isHovered ? node.title : truncated;

        ctx.fillStyle = textColor;
        ctx.font = `${12 / zoom}px system-ui, -apple-system, "Microsoft YaHei", "PingFang SC", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(label, node.x, node.y + r + 4 / zoom);
      }

      ctx.restore();
    }

    let energy = Infinity;
    function loop() {
      if (!runningRef.current) return;

      if (energy > ENERGY_THRESHOLD || dragRef.current !== null) {
        energy = physicsStep();
      }
      render();
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      resizeObserver.disconnect();
    };
  }, [dataReady]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button === 2) {
        panningRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          origX: panRef.current.x,
          origY: panRef.current.y,
        };
        return;
      }

      if (e.button !== 0) return;

      const w = worldFromEvent(e);
      if (!w) return;

      const idx = findNodeAt(w.wx, w.wy);
      if (idx !== null) {
        nodesRef.current[idx].fixed = true;
        dragRef.current = { nodeIdx: idx, moved: false };
      } else {
        panningRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          origX: panRef.current.x,
          origY: panRef.current.y,
        };
      }
    },
    [worldFromEvent, findNodeAt],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const w = worldFromEvent(e);
      if (!w) return;

      if (dragRef.current !== null) {
        const dx = e.movementX;
        const dy = e.movementY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          dragRef.current.moved = true;
        }
        const node = nodesRef.current[dragRef.current.nodeIdx];
        node.x = w.wx;
        node.y = w.wy;
        node.vx = 0;
        node.vy = 0;
        return;
      }

      if (panningRef.current !== null) {
        panRef.current = {
          x: panningRef.current.origX + (e.clientX - panningRef.current.startX),
          y: panningRef.current.origY + (e.clientY - panningRef.current.startY),
        };
        return;
      }

      const idx = findNodeAt(w.wx, w.wy);
      const next = idx !== null ? nodesRef.current[idx] : null;
      if (next !== hoveredRef.current) {
        hoveredRef.current = next;
        setHoveredNode(next);
        if (next) {
          const canvas = canvasRef.current;
          if (canvas) {
            const rect = canvas.getBoundingClientRect();
            setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }
        }
      } else if (next) {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }
      }
    },
    [worldFromEvent, findNodeAt],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (dragRef.current !== null) {
        nodesRef.current[dragRef.current.nodeIdx].fixed = false;
        if (!dragRef.current.moved) {
          const node = nodesRef.current[dragRef.current.nodeIdx];
          const paper = papers.find(
            (p) => p.title.toLowerCase() === node.title.toLowerCase(),
          );
          if (paper) onNavigate(paper);
        }
        dragRef.current = null;
        return;
      }

      panningRef.current = null;
    },
    [papers, onNavigate],
  );

  const handleMouseLeave = useCallback(() => {
    dragRef.current = null;
    panningRef.current = null;
    hoveredRef.current = null;
    setHoveredNode(null);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.3, Math.min(3.0, zoomRef.current * delta));

    const w = worldFromEvent(e);
    if (w) {
      panRef.current = {
        x: e.clientX - canvasRef.current!.getBoundingClientRect().left - w.wx * newZoom,
        y: e.clientY - canvasRef.current!.getBoundingClientRect().top - w.wy * newZoom,
      };
    }

    zoomRef.current = newZoom;
  }, [worldFromEvent]);

  const zoomIn = useCallback(() => {
    zoomRef.current = Math.min(zoomRef.current * 1.2, 3.0);
  }, []);

  const zoomOut = useCallback(() => {
    zoomRef.current = Math.max(zoomRef.current / 1.2, 0.3);
  }, []);

  const resetView = useCallback(() => {
    zoomRef.current = 1.0;
    panRef.current = { x: 0, y: 0 };
  }, []);

  if (loading) {
    return (
      <div className="graph-container">
        <div className="graph-empty">加载中...</div>
      </div>
    );
  }

  if (nodesRef.current.length === 0) {
    return (
      <div className="graph-container">
        <div className="graph-empty">
          暂无笔记引用关系，在笔记中使用 [[笔记标题]] 建立链接
        </div>
      </div>
    );
  }

  return (
    <div className="graph-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="graph-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="graph-controls">
        <button className="graph-zoom-btn" onClick={zoomIn} title="放大">+</button>
        <button className="graph-zoom-btn" onClick={zoomOut} title="缩小">{'−'}</button>
        <button className="graph-zoom-btn" onClick={resetView} title="重置">{'⟲'}</button>
      </div>
      {hoveredNode && (
        <div
          className="graph-tooltip"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          {hoveredNode.title}
        </div>
      )}
    </div>
  );
}
