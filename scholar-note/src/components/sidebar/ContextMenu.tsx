import { useEffect, useRef } from 'react';

export interface MenuAction {
  label: string;
  icon?: string;
  onClick: () => void;
  danger?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  actions: MenuAction[];
  onClose: () => void;
}

export function ContextMenu({ x, y, actions, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    left: x,
    top: y,
    zIndex: 200,
  };

  return (
    <div className="context-menu" ref={menuRef} style={style}>
      {actions.map((action, i) => (
        <button
          key={i}
          className={`context-menu-item${action.danger ? ' danger' : ''}`}
          onClick={() => { action.onClick(); onClose(); }}
        >
          {action.icon && <span className="context-menu-icon">{action.icon}</span>}
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}
