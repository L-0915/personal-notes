import { useState, useEffect, useCallback } from 'react';
import { useUiStore } from '@/stores/uiStore';

type SettingsTab = 'general' | 'editor' | 'shortcuts' | 'backup' | 'trash' | 'help' | 'about';

interface TrashItem {
  name: string;
  originalName: string;
  path: string;
  deletedAt: number;
}

export function SettingsDialog() {
  const showSettings = useUiStore((s) => s.showSettings);
  const setShowSettings = useUiStore((s) => s.setShowSettings);
  const [tab, setTab] = useState<SettingsTab>('general');
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [vaultPath, setVaultPath] = useState('');
  const [saved, setSaved] = useState(false);
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [backups, setBackups] = useState<Array<{ name: string; path: string; createdAt: number }>>([]);
  const [backupStatus, setBackupStatus] = useState('');

  useEffect(() => {
    if (showSettings) {
      loadSettings();
      if (tab === 'trash') loadTrash();
      if (tab === 'backup') loadBackups();
    }
  }, [showSettings]);

  const loadSettings = async () => {
    const s = await window.electronAPI.readSettings();
    setSettings(s);
    const vp = await window.electronAPI.getVaultPath();
    setVaultPath(vp);
  };

  const loadTrash = useCallback(async () => {
    const items = await window.electronAPI.trashList();
    setTrashItems(items);
  }, []);

  useEffect(() => {
    if (tab === 'trash' && showSettings) loadTrash();
    if (tab === 'backup' && showSettings) loadBackups();
  }, [tab, showSettings, loadTrash]);

  const loadBackups = async () => {
    try {
      const list = await window.electronAPI.backupList();
      setBackups(list);
    } catch { /* ignore */ }
  };

  if (!showSettings) return null;

  const updateSetting = async (key: string, value: unknown) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    await window.electronAPI.writeSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleChangeVault = async () => {
    const newPath = await window.electronAPI.selectVault();
    if (newPath) {
      const result = await window.electronAPI.setVaultPath(newPath);
      if (result.success) {
        setVaultPath(newPath);
      }
    }
  };

  const handleShowInExplorer = async () => {
    await window.electronAPI.showInExplorer(vaultPath);
  };

  const handleRestore = async (item: TrashItem) => {
    await window.electronAPI.trashRestore(item.path);
    loadTrash();
  };

  const handlePermanentDelete = async (item: TrashItem) => {
    await window.electronAPI.trashPermanentDelete(item.path);
    loadTrash();
  };

  const handleEmptyTrash = async () => {
    await window.electronAPI.trashEmpty();
    loadTrash();
  };

  const tabs: { key: SettingsTab; label: string }[] = [
    { key: 'general', label: '通用' },
    { key: 'editor', label: '编辑器' },
    { key: 'shortcuts', label: '快捷键' },
    { key: 'backup', label: '备份' },
    { key: 'trash', label: '回收站' },
    { key: 'help', label: '帮助' },
    { key: 'about', label: '关于' },
  ];

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) setShowSettings(false);
  };

  const formatDate = (ts: number) => {
    if (!ts) return '未知';
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="dialog-overlay" onClick={handleBackdropClick}>
      <div className="dialog dialog-wide">
        <div className="dialog-header-row">
          <h3>设置</h3>
          {saved && <span className="save-hint">已保存</span>}
        </div>

        <div className="dialog-tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`dialog-tab${tab === t.key ? ' active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'general' && (
          <div className="settings-section">
            <div className="settings-row">
              <label>存储路径</label>
              <div className="settings-vault-row">
                <code className="vault-path">{vaultPath}</code>
                <button className="btn-secondary btn-sm" onClick={handleChangeVault}>更改</button>
                <button className="btn-secondary btn-sm" onClick={handleShowInExplorer}>打开</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'editor' && (
          <div className="settings-section">
            <div className="settings-row">
              <label>字体大小</label>
              <select
                value={String(settings.editorFontSize ?? 16)}
                onChange={(e) => updateSetting('editorFontSize', Number(e.target.value))}
              >
                <option value="14">14px</option>
                <option value="16">16px</option>
                <option value="18">18px</option>
                <option value="20">20px</option>
              </select>
            </div>
            <div className="settings-row">
              <label>自动保存间隔</label>
              <select
                value={String(settings.autoSaveInterval ?? 1)}
                onChange={(e) => updateSetting('autoSaveInterval', Number(e.target.value))}
              >
                <option value="1">1 秒</option>
                <option value="3">3 秒</option>
                <option value="5">5 秒</option>
              </select>
            </div>
          </div>
        )}

        {tab === 'shortcuts' && (
          <div className="settings-section">
            <div className="shortcut-row"><kbd>Ctrl+N</kbd><span>导入笔记</span></div>
            <div className="shortcut-row"><kbd>Ctrl+,</kbd><span>打开设置</span></div>
            <div className="shortcut-row"><kbd>Ctrl+S</kbd><span>立即保存</span></div>
            <div className="shortcut-row"><kbd>Ctrl+F</kbd><span>搜索笔记</span></div>
            <div className="shortcut-row"><kbd>Ctrl+E</kbd><span>预览/编辑切换</span></div>
          </div>
        )}

        {tab === 'backup' && (
          <div className="settings-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>备份保存在仓库的 <code>.backup</code> 目录中</span>
              <button className="btn-primary btn-sm" onClick={async () => {
                setBackupStatus('正在备份...');
                const result = await window.electronAPI.backupNow();
                if (result.success) {
                  setBackupStatus('备份成功');
                  loadBackups();
                } else {
                  setBackupStatus(result.error || '备份失败');
                }
                setTimeout(() => setBackupStatus(''), 3000);
              }}>立即备份</button>
            </div>
            {backupStatus && <p style={{ fontSize: '0.8rem', color: 'var(--accent)', marginBottom: 8 }}>{backupStatus}</p>}
            {backups.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '16px 0' }}>
                暂无备份
              </p>
            ) : (
              <ul className="trash-list">
                {backups.map((b) => (
                  <li key={b.name} className="trash-item">
                    <div className="trash-item-info">
                      <span className="trash-item-name">{b.name}</span>
                      <span className="trash-item-date">{formatDate(b.createdAt)}</span>
                    </div>
                    <div className="trash-item-actions">
                      <button className="btn-secondary btn-sm" onClick={() => window.electronAPI.showInExplorer(b.path)}>打开</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'trash' && (
          <div className="settings-section">
            {trashItems.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '16px 0' }}>
                回收站为空
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <button className="btn-secondary btn-sm" onClick={handleEmptyTrash}>
                    清空回收站
                  </button>
                </div>
                <ul className="trash-list">
                  {trashItems.map((item) => (
                    <li key={item.name} className="trash-item">
                      <div className="trash-item-info">
                        <span className="trash-item-name">{item.originalName}</span>
                        <span className="trash-item-date">{formatDate(item.deletedAt)}</span>
                      </div>
                      <div className="trash-item-actions">
                        <button className="btn-secondary btn-sm" onClick={() => handleRestore(item)}>恢复</button>
                        <button className="btn-danger btn-sm" onClick={() => handlePermanentDelete(item)}>永久删除</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {tab === 'help' && (
          <div className="settings-section help-section-text">
            <h4>笔记保存位置</h4>
            <p>笔记默认保存在 <code>D:\ScholarNote\</code> 目录下。如果 D 盘不可用则回退到用户文档目录。</p>
            <p>你可以在「通用」标签页中查看当前路径，点击「更改」选择新位置，或点击「打开」在资源管理器中查看。</p>

            <h4>在笔记中链接本地文件</h4>
            <p>你可以在 Markdown 中插入指向本地文件的链接，预览中点击即可用系统默认程序打开：</p>
            <pre className="help-code">[论文PDF](D:\Papers\my-paper.pdf)</pre>
            <p>支持绝对路径和相对路径（相对于仓库目录）。</p>

            <h4>导入论文元数据</h4>
            <p>点击 ↓ 按钮选择「在线导入」，粘贴论文的 DOI、arXiv 链接或 Semantic Scholar 链接，软件会自动抓取标题、作者、摘要等信息并下载 PDF。</p>

            <h4>自动检测论文链接</h4>
            <p>在笔记中粘贴 arXiv 链接、DOI 或 Semantic Scholar 链接后，软件会自动获取元数据并创建一篇新的笔记。当前笔记中的链接保持不变，方便你记录相关论文。</p>
          </div>
        )}

        {tab === 'about' && (
          <div className="settings-section about-section">
            <h2>ScholarNote</h2>
            <p>个人学术文献管理和笔记软件</p>
            <p className="version-info">版本 0.1.0</p>
          </div>
        )}

        <div className="dialog-actions">
          <button className="btn-secondary" onClick={() => setShowSettings(false)}>关闭</button>
        </div>
      </div>
    </div>
  );
}
