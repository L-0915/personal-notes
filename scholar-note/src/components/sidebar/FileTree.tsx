import { useState, useEffect, useCallback } from 'react';
import { useNoteStore } from '@/stores/noteStore';
import { useTagStore } from '@/stores/tagStore';
import { useUiStore, type SortBy } from '@/stores/uiStore';
import { StarRating } from '@/components/common/StarRating';
import { ContextMenu, type MenuAction } from '@/components/sidebar/ContextMenu';

interface TreeNode {
  name: string;
  path: string;
  type: 'folder' | 'file';
  children?: TreeNode[];
}

const SORT_LABELS: Record<SortBy, string> = {
  title: '标题',
  updatedDate: '修改日期',
  addedDate: '创建日期',
  rating: '评分',
};

function sortNodes(nodes: TreeNode[], sortBy: SortBy, asc: boolean, paperMap: Map<string, { updatedDate?: string; addedDate?: string; rating?: number }>): TreeNode[] {
  const sorted = [...nodes].sort((a, b) => {
    // Folders always first
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;

    if (a.type === 'folder' && b.type === 'folder') {
      return a.name.localeCompare(b.name, 'zh');
    }

    // File sorting
    const pa = paperMap.get(a.path);
    const pb = paperMap.get(b.path);
    let cmp = 0;
    switch (sortBy) {
      case 'title':
        cmp = a.name.localeCompare(b.name, 'zh');
        break;
      case 'updatedDate':
        cmp = (pa?.updatedDate ?? '').localeCompare(pb?.updatedDate ?? '');
        break;
      case 'addedDate':
        cmp = (pa?.addedDate ?? '').localeCompare(pb?.addedDate ?? '');
        break;
      case 'rating':
        cmp = (pa?.rating ?? 0) - (pb?.rating ?? 0);
        break;
    }
    return cmp;
  });
  return asc ? sorted : sorted.map((n) =>
    n.type === 'folder' ? { ...n, children: n.children ? sortNodes(n.children, sortBy, asc, paperMap) : n.children } : n
  ).reverse().map((n) => {
    // Re-sort to keep folders first after reverse
    return n;
  });
}

interface ContextMenuState {
  x: number;
  y: number;
  node: TreeNode;
}

export function FileTree() {
  const papers = useNoteStore((s) => s.papers);
  const currentPaper = useNoteStore((s) => s.currentPaper);
  const setCurrentPaper = useNoteStore((s) => s.setCurrentPaper);
  const setCurrentContent = useNoteStore((s) => s.setCurrentContent);
  const updatePaperRating = useNoteStore((s) => s.updatePaperRating);
  const selectedTags = useTagStore((s) => s.selectedTags);
  const setPapers = useNoteStore((s) => s.setPapers);

  const togglePin = useCallback(async (paperId: number, currentPinned: boolean) => {
    await window.electronAPI.dbUpdatePaper(paperId, { pinned: !currentPinned });
    const updated = await window.electronAPI.dbGetAllPapers();
    setPapers(updated);
  }, [setPapers]);
  const sortBy = useUiStore((s) => s.sortBy);
  const sortAsc = useUiStore((s) => s.sortAsc);
  const setSortBy = useUiStore((s) => s.setSortBy);
  const toggleSortOrder = useUiStore((s) => s.toggleSortOrder);

  const [tree, setTree] = useState<TreeNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [newFolderParent, setNewFolderParent] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFileParent, setNewFileParent] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Build a map from filePath to paper data for quick lookups
  const paperMap = new Map(papers.map((p) => [p.filePath, p]));

  const filteredPaths = selectedTags.length > 0
    ? new Set(papers.filter((p) => p.tags.some((t) => selectedTags.includes(t.name))).map((p) => p.filePath))
    : null;

  const loadTree = useCallback(async () => {
    try {
      const nodes = await window.electronAPI.listFileTree();
      setTree(nodes);
    } catch {
      setTree([]);
    }
  }, []);

  useEffect(() => {
    loadTree();
  }, [papers, loadTree]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
  };

  const handleSelect = async (node: TreeNode) => {
    if (node.type === 'folder') {
      toggleFolder(node.path);
      return;
    }
    const paper = papers.find((p) => p.filePath === node.path);
    if (paper) {
      setCurrentPaper(paper);
    } else {
      setCurrentPaper({
        id: -1,
        title: node.name,
        slug: node.name,
        filePath: node.path,
        pdfPath: null,
        doi: null,
        url: null,
        year: null,
        journal: null,
        abstract: null,
        citations: 0,
        readingStatus: 'to-read',
        rating: 0,
        addedDate: '',
        updatedDate: '',
        bibtex: null,
        pinned: false,
        authors: [],
        tags: [],
      });
    }
    try {
      const result = await window.electronAPI.readFile(node.path);
      if (typeof result === 'string') setCurrentContent(result);
    } catch {
      setCurrentContent('');
    }
  };

  const handleDelete = async (paperId: number, filePath: string) => {
    try {
      const fileResult = await window.electronAPI.deleteFile(filePath);
      if (!fileResult.success) return;
      await window.electronAPI.dbDeletePaper(paperId);
      if (currentPaper?.id === paperId) {
        setCurrentPaper(null);
        setCurrentContent('');
      }
      const updated = await window.electronAPI.dbGetAllPapers();
      setPapers(updated);
    } catch { /* ignore */ }
    setConfirmDeleteId(null);
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    await window.electronAPI.createFolder(newFolderParent ? `${newFolderParent}/${name}` : name);
    setNewFolderName('');
    setNewFolderParent(null);
    loadTree();
  };

  const handleCreateFile = async () => {
    const name = newFileName.trim();
    if (!name || !newFileParent) return;
    const result = await window.electronAPI.createNote(name, newFileParent);
    if (result.success) {
      setNewFileName('');
      setNewFileParent(null);
      loadTree();
      const updated = await window.electronAPI.dbGetAllPapers();
      setPapers(updated);
    }
  };

  const handleRename = async (nodePath: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setRenamingPath(null);
      return;
    }
    const node = findNode(tree, nodePath);
    if (!node) return;

    if (node.type === 'file') {
      const result = await window.electronAPI.renameFile(nodePath, trimmed);
      if (result.success) {
        loadTree();
        const updated = await window.electronAPI.dbGetAllPapers();
        setPapers(updated);
        if (currentPaper?.filePath === nodePath) {
          const newPaper = updated.find((p: { title: string }) => p.title === trimmed);
          if (newPaper) {
            setCurrentPaper(newPaper);
            try {
              const content = await window.electronAPI.readFile(newPaper.filePath);
              if (typeof content === 'string') setCurrentContent(content);
            } catch { /* ignore */ }
          }
        }
      }
    } else {
      const result = await window.electronAPI.renameFolder(nodePath, trimmed);
      if (result.success) {
        loadTree();
        const updated = await window.electronAPI.dbGetAllPapers();
        setPapers(updated);
      }
    }
    setRenamingPath(null);
  };

  const handleContextMenu = (e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  const handleContextAction = async (action: string, node: TreeNode) => {
    switch (action) {
      case 'rename':
        setRenamingPath(node.path);
        setRenameValue(node.name);
        break;
      case 'delete-file': {
        const paper = paperMap.get(node.path);
        if (paper) setConfirmDeleteId(paper.id);
        break;
      }
      case 'delete-folder':
        if (node.path) {
          await window.electronAPI.deleteFolder(node.path);
          loadTree();
        }
        break;
      case 'new-file':
        setNewFileParent(node.path);
        setNewFileName('');
        toggleFolder(node.path);
        break;
      case 'new-folder': {
        const lastSep = Math.max(node.path.lastIndexOf('/'), node.path.lastIndexOf('\\'));
        const parentDir = lastSep > 0 ? node.path.substring(0, lastSep) : '';
        setNewFolderParent(parentDir);
        setNewFolderName('');
        break;
      }
      case 'show-in-explorer':
        await window.electronAPI.showInExplorer(node.path);
        break;
    }
  };

  const getContextMenuActions = (node: TreeNode): MenuAction[] => {
    if (node.type === 'folder') {
      return [
        { label: '新建笔记', icon: '📄', onClick: () => handleContextAction('new-file', node) },
        { label: '新建文件夹', icon: '📁', onClick: () => handleContextAction('new-folder', node) },
        { label: '重命名', icon: '✏️', onClick: () => handleContextAction('rename', node) },
        { label: '在资源管理器中显示', icon: '📂', onClick: () => handleContextAction('show-in-explorer', node) },
        { label: '删除文件夹', icon: '🗑️', onClick: () => handleContextAction('delete-folder', node), danger: true },
      ];
    }
    return [
      { label: '重命名', icon: '✏️', onClick: () => handleContextAction('rename', node) },
      { label: '在资源管理器中显示', icon: '📂', onClick: () => handleContextAction('show-in-explorer', node) },
      { label: '删除', icon: '🗑️', onClick: () => handleContextAction('delete-file', node), danger: true },
    ];
  };

  const findNode = (nodes: TreeNode[], targetPath: string): TreeNode | null => {
    for (const n of nodes) {
      if (n.path === targetPath) return n;
      if (n.children) {
        const found = findNode(n.children, targetPath);
        if (found) return found;
      }
    }
    return null;
  };

  const hasFiles = (nodes: TreeNode[]): boolean => {
    return nodes.some((n) => {
      if (filteredPaths) return n.type === 'file' && filteredPaths.has(n.path);
      return n.type === 'file';
    }) || nodes.some((n) => n.children && hasFiles(n.children));
  };

  const renderNode = (node: TreeNode, depth: number) => {
    if (node.type === 'folder') {
      if (filteredPaths && node.children && !hasFiles(node.children)) return null;

      const isExpanded = expandedFolders.has(node.path);
      const isRenaming = renamingPath === node.path;
      return (
        <li key={node.path}>
          <div
            className="folder-item"
            style={{ paddingLeft: 12 + depth * 16 }}
            onClick={() => toggleFolder(node.path)}
            onContextMenu={(e) => handleContextMenu(e, node)}
          >
            <span className="folder-arrow">{isExpanded ? '▾' : '▸'}</span>
            <span className="folder-icon">📁</span>
            {isRenaming ? (
              <input
                className="rename-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename(node.path, renameValue);
                  if (e.key === 'Escape') setRenamingPath(null);
                  e.stopPropagation();
                }}
                onBlur={() => handleRename(node.path, renameValue)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <span className="folder-name">{node.name}</span>
            )}
            <button
              className="btn-folder-action"
              onClick={(e) => { e.stopPropagation(); setNewFileParent(node.path); setNewFileName(''); }}
              title="新建笔记"
            >
              +
            </button>
          </div>
          {isExpanded && node.children && (
            <ul className="tree-children">
              {sortNodes(node.children, sortBy, sortAsc, paperMap).map((child) => renderNode(child, depth + 1))}
            </ul>
          )}
        </li>
      );
    }

    // File node
    if (filteredPaths && !filteredPaths.has(node.path)) return null;

    const paper = paperMap.get(node.path);
    const isRenaming = renamingPath === node.path;
    return (
      <li
        key={node.path}
        className={`file-item${currentPaper?.filePath === node.path ? ' active' : ''}`}
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={() => handleSelect(node)}
        onContextMenu={(e) => handleContextMenu(e, node)}
      >
        {isRenaming ? (
          <input
            className="rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename(node.path, renameValue);
              if (e.key === 'Escape') setRenamingPath(null);
              e.stopPropagation();
            }}
            onBlur={() => handleRename(node.path, renameValue)}
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
        ) : (
          <span className="file-title">{node.name}</span>
        )}
        {!isRenaming && (
          <div className="file-item-actions">
            {paper && (
              <>
                <button
                  className={`btn-pin${paper.pinned ? ' active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); togglePin(paper.id, !!paper.pinned); }}
                  title={paper.pinned ? '取消置顶' : '置顶'}
                >
                  📌
                </button>
                <StarRating
                  rating={paper.rating}
                  onChange={(r) => updatePaperRating(paper.id, r)}
                />
              </>
            )}
            <button
              className="btn-delete"
              onClick={(e) => { e.stopPropagation(); paper && setConfirmDeleteId(paper.id); }}
              title="删除笔记"
            >
              ×
            </button>
          </div>
        )}
        {paper && confirmDeleteId === paper.id && (
          <div className="delete-confirm" onClick={(e) => e.stopPropagation()}>
            <span>确定删除？</span>
            <button className="btn-danger btn-sm" onClick={() => handleDelete(paper.id, paper.filePath)}>删除</button>
            <button className="btn-secondary btn-sm" onClick={() => setConfirmDeleteId(null)}>取消</button>
          </div>
        )}
      </li>
    );
  };

  const isEmpty = !hasFiles(tree) && tree.every((n) => n.type !== 'folder');

  if (isEmpty && tree.length === 0) {
    return (
      <div className="file-list-empty">
        暂无笔记，点击 + 新建或 ↓ 导入
      </div>
    );
  }

  return (
    <>
      <div className="sort-row">
        <select
          className="sort-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
        >
          {Object.entries(SORT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <button
          className="btn-icon sort-order-btn"
          onClick={toggleSortOrder}
          title={sortAsc ? '升序' : '降序'}
        >
          {sortAsc ? '↑' : '↓'}
        </button>
        <button
          className="btn-icon sort-order-btn"
          onClick={() => { setNewFolderParent(''); setNewFolderName(''); }}
          title="新建文件夹"
        >
          📁+
        </button>
      </div>

      {newFolderParent !== null && (
        <div className="new-folder-input">
          <input
            type="text"
            placeholder="文件夹名称..."
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFolder();
              if (e.key === 'Escape') { setNewFolderParent(null); setNewFolderName(''); }
            }}
            autoFocus
          />
          <button className="btn-primary btn-sm" onClick={handleCreateFolder}>创建</button>
          <button className="btn-secondary btn-sm" onClick={() => { setNewFolderParent(null); setNewFolderName(''); }}>取消</button>
        </div>
      )}

      {newFileParent !== null && (
        <div className="new-folder-input">
          <input
            type="text"
            placeholder="笔记标题..."
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFile();
              if (e.key === 'Escape') { setNewFileParent(null); setNewFileName(''); }
            }}
            autoFocus
          />
          <button className="btn-primary btn-sm" onClick={handleCreateFile}>创建</button>
          <button className="btn-secondary btn-sm" onClick={() => { setNewFileParent(null); setNewFileName(''); }}>取消</button>
        </div>
      )}

      <ul className="file-tree" onContextMenu={(e) => e.preventDefault()}>
        {sortNodes(tree, sortBy, sortAsc, paperMap).map((node) => renderNode(node, 0))}
      </ul>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={getContextMenuActions(contextMenu.node)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
