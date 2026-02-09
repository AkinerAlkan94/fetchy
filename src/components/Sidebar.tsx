import { useState, useRef, useMemo, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  FolderPlus,
  FilePlus,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Folder,
  MoreVertical,
  Trash2,
  Edit2,
  Copy,
  Plus,
  Clock,
  Download,
  Upload,
  Key,
  Filter,
  ArrowUpDown,
  GripVertical,
  X,
  MoveRight,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { Collection, RequestFolder, ApiRequest, RequestHistoryItem, HttpMethod } from '../types';
import { getMethodBgColor, exportToPostman } from '../utils/helpers';
import CollectionAuthModal from './CollectionAuthModal';
import Tooltip from './Tooltip';

interface SidebarProps {
  onImport: () => void;
  onHistoryItemClick?: (item: RequestHistoryItem) => void;
}

type SortOption = 'name-asc' | 'name-desc' | 'method' | 'created';
type FilterMethod = HttpMethod | 'all';

interface DragItem {
  type: 'collection' | 'folder' | 'request';
  id: string;
  collectionId: string;
  folderId?: string;
  index: number;
}

// Sortable Collection Item
function SortableCollectionItem({
  collection,
  children,
  onToggle,
  onContextMenu,
  editingId,
  editingName,
  setEditingName,
  inputRef,
  onEditComplete,
}: {
  collection: Collection;
  children: React.ReactNode;
  onToggle: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  editingId: string | null;
  editingName: string;
  setEditingName: (name: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  onEditComplete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `collection-${collection.id}`,
    data: { type: 'collection', collectionId: collection.id, collection }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-2">
      <div
        className="tree-item flex items-center gap-2 px-2 py-2 cursor-pointer group rounded"
        onClick={onToggle}
        onContextMenu={onContextMenu}
      >
        <button
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-aki-border rounded cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={12} className="text-aki-text-muted" />
        </button>
        {collection.expanded ? (
          <ChevronDown size={16} className="text-aki-text-muted shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-aki-text-muted shrink-0" />
        )}
        {editingId === collection.id ? (
          <input
            ref={inputRef}
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={onEditComplete}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onEditComplete();
              if (e.key === 'Escape') onEditComplete();
            }}
            className="flex-1 bg-transparent border-b border-aki-accent text-sm outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="text-sm font-medium text-aki-text truncate flex-1">
            {collection.name}
          </span>
        )}
        <button
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-aki-border rounded"
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e);
          }}
        >
          <MoreVertical size={14} />
        </button>
      </div>
      {collection.expanded && children}
    </div>
  );
}

// Sortable Request Item
function SortableRequestItem({
  request,
  collectionId,
  folderId,
  depth,
  onClick,
  onContextMenu,
  editingId,
  editingName,
  setEditingName,
  inputRef,
  onEditComplete,
}: {
  request: ApiRequest;
  collectionId: string;
  folderId?: string;
  depth: number;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  editingId: string | null;
  editingName: string;
  setEditingName: (name: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  onEditComplete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `request-${request.id}`,
    data: { type: 'request', collectionId, folderId, request }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="tree-item flex items-center gap-2 px-2 py-1.5 cursor-pointer group rounded"
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <button
        {...attributes}
        {...listeners}
        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-aki-border rounded cursor-grab active:cursor-grabbing"
        style={{ marginLeft: `${(depth - 1) * 16}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={12} className="text-aki-text-muted" />
      </button>
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-[52px] text-center ${getMethodBgColor(request.method)}`}>
        {request.method}
      </span>
      {editingId === request.id ? (
        <input
          ref={inputRef}
          type="text"
          value={editingName}
          onChange={(e) => setEditingName(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={onEditComplete}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onEditComplete();
            if (e.key === 'Escape') onEditComplete();
          }}
          className="flex-1 px-2 py-1 text-sm bg-aki-bg border border-aki-accent rounded outline-none"
        />
      ) : (
        <span className="text-sm text-aki-text truncate flex-1">{request.name}</span>
      )}
      <button
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-aki-border rounded"
        onClick={(e) => {
          e.stopPropagation();
          onContextMenu(e);
        }}
      >
        <MoreVertical size={14} />
      </button>
    </div>
  );
}

// Sortable Folder Item
function SortableFolderItem({
  folder,
  collectionId,
  depth,
  children,
  onToggle,
  onContextMenu,
  editingId,
  editingName,
  setEditingName,
  inputRef,
  onEditComplete,
}: {
  folder: RequestFolder;
  collectionId: string;
  depth: number;
  children: React.ReactNode;
  onToggle: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  editingId: string | null;
  editingName: string;
  setEditingName: (name: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  onEditComplete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: `folder-${folder.id}`,
    data: { type: 'folder', collectionId, folder }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`tree-item flex items-center gap-2 px-2 py-1.5 cursor-pointer group rounded ${isOver ? 'bg-aki-accent/20' : ''}`}
        onClick={onToggle}
        onContextMenu={onContextMenu}
      >
        <button
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-aki-border rounded cursor-grab active:cursor-grabbing"
          style={{ marginLeft: `${(depth - 1) * 16}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={12} className="text-aki-text-muted" />
        </button>
        {folder.expanded ? (
          <ChevronDown size={14} className="text-aki-text-muted shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-aki-text-muted shrink-0" />
        )}
        <Folder size={14} className="text-yellow-400 shrink-0" />
        {editingId === folder.id ? (
          <input
            ref={inputRef}
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={onEditComplete}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onEditComplete();
              if (e.key === 'Escape') onEditComplete();
            }}
            className="flex-1 bg-transparent border-b border-aki-accent text-sm outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="text-sm text-aki-text truncate flex-1">{folder.name}</span>
        )}
        <button
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-aki-border rounded"
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e);
          }}
        >
          <MoreVertical size={14} />
        </button>
      </div>
      {folder.expanded && children}
    </div>
  );
}

export default function Sidebar({ onImport, onHistoryItemClick }: SidebarProps) {
  const {
    collections,
    addCollection,
    updateCollection,
    deleteCollection,
    toggleCollectionExpanded,
    addFolder,
    updateFolder,
    deleteFolder,
    toggleFolderExpanded,
    addRequest,
    updateRequest,
    deleteRequest,
    duplicateRequest,
    openTab,
    history,
    clearHistory,
    reorderCollections,
    reorderRequests,
    reorderFolders,
    moveRequest,
    moveFolder,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'collections' | 'history'>('collections');
  const [authModal, setAuthModal] = useState<{ open: boolean; collectionId: string; folderId?: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'collection' | 'folder' | 'request';
    collectionId: string;
    folderId?: string;
    requestId?: string;
  } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter and sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMethod, setFilterMethod] = useState<FilterMethod>('all');
  const [sortOption, setSortOption] = useState<SortOption>('name-asc');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Move to submenu state
  const [showMoveToMenu, setShowMoveToMenu] = useState(false);

  // DnD state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDragData, setActiveDragData] = useState<DragItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Filter and sort collections/requests
  const filterRequests = useCallback((requests: ApiRequest[]): ApiRequest[] => {
    let filtered = requests;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        r => r.name.toLowerCase().includes(query) || r.url.toLowerCase().includes(query)
      );
    }

    // Filter by method
    if (filterMethod !== 'all') {
      filtered = filtered.filter(r => r.method === filterMethod);
    }

    // Sort
    switch (sortOption) {
      case 'name-asc':
        filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        filtered = [...filtered].sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'method':
        filtered = [...filtered].sort((a, b) => a.method.localeCompare(b.method));
        break;
      // 'created' keeps original order
    }

    return filtered;
  }, [searchQuery, filterMethod, sortOption]);

  const hasMatchingRequests = useCallback((folder: RequestFolder): boolean => {
    if (filterRequests(folder.requests).length > 0) return true;
    return folder.folders.some(f => hasMatchingRequests(f));
  }, [filterRequests]);

  const filterFolders = useCallback((folders: RequestFolder[]): RequestFolder[] => {
    return folders.map(folder => ({
      ...folder,
      requests: filterRequests(folder.requests),
      folders: filterFolders(folder.folders),
    })).filter(folder => {
      // Keep folder if it has matching requests or subfolders with matching requests
      if (folder.requests.length > 0) return true;
      if (folder.folders.some(f => hasMatchingRequests(f))) return true;
      if (!searchQuery && filterMethod === 'all') return true;
      return false;
    });
  }, [filterRequests, hasMatchingRequests, searchQuery, filterMethod]);

  const filteredCollections = useMemo(() => {
    if (!searchQuery && filterMethod === 'all' && sortOption === 'created') {
      return collections;
    }

    return collections.map(collection => ({
      ...collection,
      requests: filterRequests(collection.requests),
      folders: filterFolders(collection.folders),
    })).filter(collection => {
      // Keep collection if it has matching requests or folders
      if (collection.requests.length > 0) return true;
      if (collection.folders.some(f => hasMatchingRequests(f))) return true;
      if (!searchQuery && filterMethod === 'all') return true;
      // Also include if collection name matches search
      if (searchQuery && collection.name.toLowerCase().includes(searchQuery.toLowerCase())) return true;
      return false;
    });
  }, [collections, searchQuery, filterMethod, sortOption, filterRequests, filterFolders, hasMatchingRequests]);

  const handleContextMenu = (
    e: React.MouseEvent,
    type: 'collection' | 'folder' | 'request',
    collectionId: string,
    folderId?: string,
    requestId?: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type, collectionId, folderId, requestId });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
    setShowMoveToMenu(false);
  };

  const handleAddCollection = () => {
    const collection = addCollection('New Collection');
    setEditingId(collection.id);
    setEditingName(collection.name);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleRequestClick = (collectionId: string, request: ApiRequest, folderId?: string) => {
    openTab({
      type: 'request',
      title: request.name,
      requestId: request.id,
      collectionId,
      folderId,
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);

    // Parse drag data from ID
    const idStr = active.id as string;
    if (idStr.startsWith('collection-')) {
      const collectionId = idStr.replace('collection-', '');
      const index = collections.findIndex(c => c.id === collectionId);
      setActiveDragData({ type: 'collection', id: collectionId, collectionId, index });
    } else if (idStr.startsWith('request-')) {
      const data = active.data.current;
      if (data) {
        setActiveDragData({
          type: 'request',
          id: data.request.id,
          collectionId: data.collectionId,
          folderId: data.folderId,
          index: 0,
        });
      }
    } else if (idStr.startsWith('folder-')) {
      const data = active.data.current;
      if (data) {
        setActiveDragData({
          type: 'folder',
          id: data.folder.id,
          collectionId: data.collectionId,
          index: 0,
        });
      }
    }
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // Handle drag over for visual feedback
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveDragData(null);

    if (!over || active.id === over.id) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    // Handle collection reordering
    if (activeIdStr.startsWith('collection-') && overIdStr.startsWith('collection-')) {
      const activeCollectionId = activeIdStr.replace('collection-', '');
      const overCollectionId = overIdStr.replace('collection-', '');
      const oldIndex = collections.findIndex(c => c.id === activeCollectionId);
      const newIndex = collections.findIndex(c => c.id === overCollectionId);
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderCollections(oldIndex, newIndex);
      }
      return;
    }

    // Handle folder reordering within same collection or moving between collections
    if (activeIdStr.startsWith('folder-')) {
      const activeData = active.data.current;
      const overData = over.data.current;

      if (activeData && overData) {
        if (activeData.collectionId === overData.collectionId) {
          // Same collection - reorder folders
          const collection = collections.find(c => c.id === activeData.collectionId);
          if (collection) {
            const oldIndex = collection.folders.findIndex(f => f.id === activeData.folder.id);
            const newIndex = collection.folders.findIndex(f => f.id === overData.folder.id);
            if (oldIndex !== -1 && newIndex !== -1) {
              reorderFolders(activeData.collectionId, null, oldIndex, newIndex);
            }
          }
        } else {
          // Different collection - move folder
          const targetCollection = collections.find(c => c.id === overData.collectionId);
          if (targetCollection) {
            const newIndex = overData.folder
              ? targetCollection.folders.findIndex(f => f.id === overData.folder.id)
              : targetCollection.folders.length;
            moveFolder(
              activeData.collectionId,
              overData.collectionId,
              activeData.folder.id,
              newIndex !== -1 ? newIndex : undefined
            );
          }
        }
      } else if (activeData && overIdStr.startsWith('collection-')) {
        // Dropping folder onto a collection
        const targetCollectionId = overIdStr.replace('collection-', '');
        if (activeData.collectionId !== targetCollectionId) {
          moveFolder(
            activeData.collectionId,
            targetCollectionId,
            activeData.folder.id
          );
        }
      }
      return;
    }

    // Handle request reordering within same container or moving between containers
    if (activeIdStr.startsWith('request-')) {
      const activeData = active.data.current;
      const overData = over.data.current;

      if (activeData && overData) {
        const sourceCollectionId = activeData.collectionId;
        const sourceFolderId = activeData.folderId;
        const targetCollectionId = overData.collectionId;
        const targetFolderId = overData.folderId;
        const requestId = activeData.request.id;

        // Same container - reorder
        if (sourceCollectionId === targetCollectionId && sourceFolderId === targetFolderId) {
          const collection = collections.find(c => c.id === sourceCollectionId);
          if (collection) {
            const requests = sourceFolderId
              ? findFolderById(collection.folders, sourceFolderId)?.requests
              : collection.requests;
            if (requests) {
              const oldIndex = requests.findIndex(r => r.id === requestId);
              const overRequest = overData.request || overData.folder;
              const newIndex = overData.request
                ? requests.findIndex(r => r.id === overRequest.id)
                : requests.length;
              if (oldIndex !== -1 && newIndex !== -1) {
                setSortOption('created');
                reorderRequests(sourceCollectionId, sourceFolderId || null, oldIndex, newIndex);
              }
            }
          }
        } else {
          // Different container - move
          moveRequest(
            sourceCollectionId,
            sourceFolderId || null,
            targetCollectionId,
            targetFolderId || null,
            requestId
          );
        }
      } else if (activeData && overIdStr.startsWith('folder-')) {
        // Dropping request onto a folder
        const overFolderData = over.data.current;
        if (overFolderData) {
          moveRequest(
            activeData.collectionId,
            activeData.folderId || null,
            overFolderData.collectionId,
            overFolderData.folder.id,
            activeData.request.id
          );
        }
      } else if (activeData && overIdStr.startsWith('collection-')) {
        // Dropping request onto a collection (root level)
        const targetCollectionId = overIdStr.replace('collection-', '');
        moveRequest(
          activeData.collectionId,
          activeData.folderId || null,
          targetCollectionId,
          null,
          activeData.request.id
        );
      }
    }
  };

  // Helper to find folder by ID
  const findFolderById = (folders: RequestFolder[], folderId: string): RequestFolder | null => {
    for (const folder of folders) {
      if (folder.id === folderId) return folder;
      const found = findFolderById(folder.folders, folderId);
      if (found) return found;
    }
    return null;
  };

  const formatHistoryTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const formatResponseSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleExportCollection = (collectionId: string) => {
    const collection = collections.find(c => c.id === collectionId);
    if (!collection) return;

    const postmanJson = exportToPostman(collection);
    const blob = new Blob([postmanJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${collection.name.replace(/\s+/g, '_')}.postman_collection.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const expandAllFolders = (folders: RequestFolder[]): RequestFolder[] => {
    return folders.map(folder => ({
      ...folder,
      expanded: true,
      folders: expandAllFolders(folder.folders),
    }));
  };

  const collapseAllFolders = (folders: RequestFolder[]): RequestFolder[] => {
    return folders.map(folder => ({
      ...folder,
      expanded: false,
      folders: collapseAllFolders(folder.folders),
    }));
  };

  const handleExpandAll = () => {
    collections.forEach(collection => {
      updateCollection(collection.id, {
        expanded: true,
        folders: expandAllFolders(collection.folders),
      });
    });
  };

  const handleCollapseAll = () => {
    collections.forEach(collection => {
      updateCollection(collection.id, {
        expanded: false,
        folders: collapseAllFolders(collection.folders),
      });
    });
  };

  const renderFolder = (collectionId: string, folder: RequestFolder, depth: number) => {
    const folderRequests = folder.requests;
    const folderFolders = folder.folders;
    const requestIds = folderRequests.map(r => `request-${r.id}`);
    const folderIds = folderFolders.map(f => `folder-${f.id}`);

    return (
      <SortableFolderItem
        key={folder.id}
        folder={folder}
        collectionId={collectionId}
        depth={depth}
        onToggle={() => toggleFolderExpanded(collectionId, folder.id)}
        onContextMenu={(e) => handleContextMenu(e, 'folder', collectionId, folder.id)}
        editingId={editingId}
        editingName={editingName}
        setEditingName={setEditingName}
        inputRef={inputRef}
        onEditComplete={() => {
          updateFolder(collectionId, folder.id, { name: editingName });
          setEditingId(null);
        }}
      >
        <div className="ml-2">
          <SortableContext items={[...folderIds, ...requestIds]} strategy={verticalListSortingStrategy}>
            {folderFolders.map((f) => renderFolder(collectionId, f, depth + 1))}
            {folderRequests.map((request) => (
              <SortableRequestItem
                key={request.id}
                request={request}
                collectionId={collectionId}
                folderId={folder.id}
                depth={depth + 1}
                onClick={() => handleRequestClick(collectionId, request, folder.id)}
                onContextMenu={(e) => handleContextMenu(e, 'request', collectionId, folder.id, request.id)}
                editingId={editingId}
                editingName={editingName}
                setEditingName={setEditingName}
                inputRef={inputRef}
                onEditComplete={() => {
                  updateRequest(collectionId, request.id, { name: editingName });
                  setEditingId(null);
                }}
              />
            ))}
          </SortableContext>
        </div>
      </SortableFolderItem>
    );
  };

  const renderCollection = (collection: Collection) => {
    const collectionRequests = collection.requests;
    const collectionFolders = collection.folders;
    const requestIds = collectionRequests.map(r => `request-${r.id}`);
    const folderIds = collectionFolders.map(f => `folder-${f.id}`);

    return (
      <SortableCollectionItem
        key={collection.id}
        collection={collection}
        onToggle={() => toggleCollectionExpanded(collection.id)}
        onContextMenu={(e) => handleContextMenu(e, 'collection', collection.id)}
        editingId={editingId}
        editingName={editingName}
        setEditingName={setEditingName}
        inputRef={inputRef}
        onEditComplete={() => {
          useAppStore.getState().updateCollection(collection.id, { name: editingName });
          setEditingId(null);
        }}
      >
        <div className="ml-2">
          <SortableContext items={[...folderIds, ...requestIds]} strategy={verticalListSortingStrategy}>
            {collectionFolders.map((folder) => renderFolder(collection.id, folder, 1))}
            {collectionRequests.map((request) => (
              <SortableRequestItem
                key={request.id}
                request={request}
                collectionId={collection.id}
                depth={1}
                onClick={() => handleRequestClick(collection.id, request)}
                onContextMenu={(e) => handleContextMenu(e, 'request', collection.id, undefined, request.id)}
                editingId={editingId}
                editingName={editingName}
                setEditingName={setEditingName}
                inputRef={inputRef}
                onEditComplete={() => {
                  updateRequest(collection.id, request.id, { name: editingName });
                  setEditingId(null);
                }}
              />
            ))}
          </SortableContext>
        </div>
      </SortableCollectionItem>
    );
  };

  const renderHistoryItem = (item: RequestHistoryItem) => (
    <div
      key={item.id}
      className="tree-item px-2 py-2 cursor-pointer group rounded hover:bg-aki-border mb-1 border border-transparent hover:border-aki-border"
      title={`${item.request.method} ${item.request.url}\nClick to load this request and response`}
      onClick={() => onHistoryItemClick?.(item)}
    >
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-[52px] text-center ${getMethodBgColor(item.request.method)}`}>
          {item.request.method}
        </span>
        <span className="text-sm text-aki-text truncate flex-1">{item.request.name || item.request.url}</span>
        <span className="text-xs text-aki-text-muted whitespace-nowrap">
          {formatHistoryTime(item.timestamp)}
        </span>
      </div>
      <div className="text-xs text-aki-text-muted truncate mt-1 ml-7">
        {item.request.url}
      </div>
      {item.response && (
        <div className="flex items-center gap-3 mt-1 ml-7 text-xs">
          <span className={`font-medium ${item.response.status >= 200 && item.response.status < 300 ? 'text-green-400' : item.response.status >= 400 ? 'text-red-400' : 'text-yellow-400'}`}>
            {item.response.status} {item.response.statusText}
          </span>
          <span className="text-aki-text-muted">{item.response.time}ms</span>
          <span className="text-aki-text-muted">{formatResponseSize(item.response.size)}</span>
        </div>
      )}
    </div>
  );

  const collectionIds = filteredCollections.map(c => `collection-${c.id}`);

  const hasActiveFilters = searchQuery || filterMethod !== 'all' || sortOption !== 'created';

  return (
    <div className="h-full bg-aki-sidebar flex flex-col border-r border-aki-border">
      {/* Header */}
      <div className="p-3 border-b border-aki-border">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-aki-text">Collections</span>
          <div className="flex items-center gap-1">
            <Tooltip content="New Collection">
              <button
                onClick={handleAddCollection}
                className="p-1.5 hover:bg-aki-border rounded text-aki-text-muted hover:text-aki-text"
              >
                <Plus size={16} />
              </button>
            </Tooltip>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('collections')}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'collections'
                ? 'bg-aki-border text-aki-text'
                : 'text-aki-text-muted hover:bg-aki-border'
            }`}
          >
            <Folder size={16} />
            Collections
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'history'
                ? 'bg-aki-border text-aki-text'
                : 'text-aki-text-muted hover:bg-aki-border'
            }`}
          >
            <Clock size={16} />
            History
          </button>
        </div>
      </div>

      {/* Filter/Search Bar - Only for collections tab */}
      {activeTab === 'collections' && collections.length > 0 && (
        <div className="p-2 border-b border-aki-border">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-7 py-1.5 text-sm bg-aki-bg border border-aki-border rounded focus:outline-none focus:border-aki-accent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-aki-text-muted hover:text-aki-text"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <Tooltip content="Expand All">
              <button
                onClick={handleExpandAll}
                className="p-1.5 rounded border border-aki-border text-aki-text-muted hover:text-aki-text hover:bg-aki-border"
              >
                <ChevronDown size={14} />
              </button>
            </Tooltip>
            <Tooltip content="Collapse All">
              <button
                onClick={handleCollapseAll}
                className="p-1.5 rounded border border-aki-border text-aki-text-muted hover:text-aki-text hover:bg-aki-border"
              >
                <ChevronUp size={14} />
              </button>
            </Tooltip>
            <Tooltip content="Import Collection">
              <button
                onClick={onImport}
                className="p-1.5 rounded border border-aki-border text-aki-text-muted hover:text-aki-text hover:bg-aki-border"
              >
                <Upload size={14} />
              </button>
            </Tooltip>
            <div className="relative">
              <Tooltip content="Filter & Sort">
                <button
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  className={`p-1.5 rounded border ${hasActiveFilters ? 'bg-aki-accent/20 border-aki-accent text-aki-accent' : 'border-aki-border text-aki-text-muted hover:text-aki-text hover:bg-aki-border'}`}
                >
                  <Filter size={14} />
                </button>
              </Tooltip>
              {showFilterMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowFilterMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-aki-card border border-aki-border rounded-lg shadow-xl py-2 min-w-[180px]">
                    <div className="px-3 py-1 text-xs font-medium text-aki-text-muted uppercase">Filter by Method</div>
                    {(['all', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const).map((method) => (
                      <button
                        key={method}
                        className={`w-full px-3 py-1.5 text-left text-sm hover:bg-aki-border flex items-center gap-2 ${filterMethod === method ? 'text-aki-accent' : ''}`}
                        onClick={() => {
                          setFilterMethod(method);
                        }}
                      >
                        {method === 'all' ? 'All Methods' : method}
                        {filterMethod === method && <span className="ml-auto">✓</span>}
                      </button>
                    ))}
                    <hr className="my-2 border-aki-border" />
                    <div className="px-3 py-1 text-xs font-medium text-aki-text-muted uppercase flex items-center gap-1">
                      <ArrowUpDown size={12} /> Sort by
                    </div>
                    {([
                      { value: 'created', label: 'Created Order' },
                      { value: 'name-asc', label: 'Name (A-Z)' },
                      { value: 'name-desc', label: 'Name (Z-A)' },
                      { value: 'method', label: 'Method' },
                    ] as const).map((option) => (
                      <button
                        key={option.value}
                        className={`w-full px-3 py-1.5 text-left text-sm hover:bg-aki-border flex items-center gap-2 ${sortOption === option.value ? 'text-aki-accent' : ''}`}
                        onClick={() => {
                          setSortOption(option.value);
                        }}
                      >
                        {option.label}
                        {sortOption === option.value && <span className="ml-auto">✓</span>}
                      </button>
                    ))}
                    {hasActiveFilters && (
                      <>
                        <hr className="my-2 border-aki-border" />
                        <button
                          className="w-full px-3 py-1.5 text-left text-sm hover:bg-aki-border text-red-400"
                          onClick={() => {
                            setSearchQuery('');
                            setFilterMethod('all');
                            setSortOption('created');
                            setShowFilterMenu(false);
                          }}
                        >
                          Clear All Filters
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content list */}
      <div className="flex-1 overflow-y-auto p-2">
        {activeTab === 'collections' && collections.length === 0 ? (
          <div className="text-center py-8 text-aki-text-muted">
            <p className="text-sm mb-4">No collections yet</p>
            <button
              onClick={handleAddCollection}
              className="btn btn-primary text-sm"
            >
              Create Collection
            </button>
            <p className="text-xs mt-3">or</p>
            <button
              onClick={onImport}
              className="text-aki-accent hover:underline text-sm mt-2"
            >
              Import from file
            </button>
          </div>
        ) : activeTab === 'collections' ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={collectionIds} strategy={verticalListSortingStrategy}>
              {filteredCollections.map(renderCollection)}
            </SortableContext>
            <DragOverlay>
              {activeId && activeDragData && (
                <div className="bg-aki-card border border-aki-accent rounded px-3 py-2 shadow-lg opacity-90">
                  <span className="text-sm text-aki-text">
                    {activeDragData.type === 'collection' && collections.find(c => c.id === activeDragData.id)?.name}
                    {activeDragData.type === 'request' && 'Moving request...'}
                    {activeDragData.type === 'folder' && 'Moving folder...'}
                  </span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-aki-text-muted">
            <Clock size={32} className="mx-auto mb-4 opacity-50" />
            <p className="text-sm mb-2">No request history yet</p>
            <p className="text-xs">Your past requests will appear here</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs text-aki-text-muted">{history.length} request{history.length !== 1 ? 's' : ''}</span>
              <button
                onClick={clearHistory}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Clear All
              </button>
            </div>
            {history.map(renderHistoryItem)}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeContextMenu} />
          <div
            className="context-menu fixed z-50 bg-aki-card border border-aki-border rounded-lg shadow-xl py-1 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {contextMenu.type === 'collection' && (
              <>
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-aki-border flex items-center gap-2"
                  onClick={() => {
                    addRequest(contextMenu.collectionId, null);
                    closeContextMenu();
                  }}
                >
                  <FilePlus size={14} /> Add Request
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-aki-border flex items-center gap-2"
                  onClick={() => {
                    addFolder(contextMenu.collectionId, null, 'New Folder');
                    closeContextMenu();
                  }}
                >
                  <FolderPlus size={14} /> Add Folder
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-aki-border flex items-center gap-2"
                  onClick={() => {
                    const collection = collections.find(c => c.id === contextMenu.collectionId);
                    if (collection) {
                      setEditingId(collection.id);
                      setEditingName(collection.name);
                      closeContextMenu();
                      setTimeout(() => inputRef.current?.focus(), 0);
                    }
                  }}
                >
                  <Edit2 size={14} /> Rename
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-aki-border flex items-center gap-2"
                  onClick={() => {
                    handleExportCollection(contextMenu.collectionId);
                    closeContextMenu();
                  }}
                >
                  <Download size={14} /> Export to Postman
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-aki-border flex items-center gap-2"
                  onClick={() => {
                    setAuthModal({ open: true, collectionId: contextMenu.collectionId });
                    closeContextMenu();
                  }}
                >
                  <Key size={14} /> Auth Settings
                </button>
                <hr className="my-1 border-aki-border" />
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-aki-border flex items-center gap-2 text-red-400"
                  onClick={() => {
                    deleteCollection(contextMenu.collectionId);
                    closeContextMenu();
                  }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </>
            )}
            {contextMenu.type === 'folder' && (
              <>
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-aki-border flex items-center gap-2"
                  onClick={() => {
                    addRequest(contextMenu.collectionId, contextMenu.folderId!);
                    closeContextMenu();
                  }}
                >
                  <FilePlus size={14} /> Add Request
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-aki-border flex items-center gap-2"
                  onClick={() => {
                    addFolder(contextMenu.collectionId, contextMenu.folderId!, 'New Folder');
                    closeContextMenu();
                  }}
                >
                  <FolderPlus size={14} /> Add Subfolder
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-aki-border flex items-center gap-2"
                  onClick={() => {
                    // Find the folder to edit
                    const collection = collections.find(c => c.id === contextMenu.collectionId);
                    if (collection) {
                      const folder = findFolderById(collection.folders, contextMenu.folderId!);
                      if (folder) {
                        setEditingId(folder.id);
                        setEditingName(folder.name);
                        closeContextMenu();
                        setTimeout(() => inputRef.current?.focus(), 0);
                      }
                    }
                  }}
                >
                  <Edit2 size={14} /> Rename
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-aki-border flex items-center gap-2"
                  onClick={() => {
                    setAuthModal({ open: true, collectionId: contextMenu.collectionId, folderId: contextMenu.folderId });
                    closeContextMenu();
                  }}
                >
                  <Key size={14} /> Auth Settings
                </button>
                {collections.length > 1 && (
                  <div className="relative">
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-aki-border flex items-center gap-2 justify-between"
                      onClick={() => setShowMoveToMenu(!showMoveToMenu)}
                    >
                      <span className="flex items-center gap-2">
                        <MoveRight size={14} /> Move to
                      </span>
                      <ChevronRight size={14} />
                    </button>
                    {showMoveToMenu && (
                      <div className="absolute left-full top-0 ml-1 bg-aki-card border border-aki-border rounded-lg shadow-xl py-1 min-w-[160px] z-50">
                        {collections
                          .filter(c => c.id !== contextMenu.collectionId)
                          .map(targetCollection => (
                            <button
                              key={targetCollection.id}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-aki-border flex items-center gap-2"
                              onClick={() => {
                                moveFolder(
                                  contextMenu.collectionId,
                                  targetCollection.id,
                                  contextMenu.folderId!
                                );
                                closeContextMenu();
                              }}
                            >
                              <Folder size={14} className="text-yellow-400" />
                              <span className="truncate">{targetCollection.name}</span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
                <hr className="my-1 border-aki-border" />
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-aki-border flex items-center gap-2 text-red-400"
                  onClick={() => {
                    deleteFolder(contextMenu.collectionId, contextMenu.folderId!);
                    closeContextMenu();
                  }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </>
            )}
            {contextMenu.type === 'request' && (() => {
              const collection = collections.find(c => c.id === contextMenu.collectionId);
              if (!collection) return null;

              const findParent = (
                folders: RequestFolder[],
                folderId: string | undefined
              ): { requests: ApiRequest[] } | null => {
                if (!folderId) return collection;
                for (const folder of folders) {
                  if (folder.id === folderId) return folder;
                  const found = findParent(folder.folders, folderId);
                  if (found) return found;
                }
                return null;
              };

              const parent = findParent(collection.folders, contextMenu.folderId);
              if (!parent) return null;

              const requestIndex = parent.requests.findIndex(r => r.id === contextMenu.requestId);
              if (requestIndex === -1) return null;

              const canMoveUp = requestIndex > 0;
              const canMoveDown = requestIndex < parent.requests.length - 1;

              return (
                <>
                  {canMoveUp && (
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-aki-border flex items-center gap-2"
                      onClick={() => {
                        setSortOption('created');
                        reorderRequests(contextMenu.collectionId, contextMenu.folderId || null, requestIndex, requestIndex - 1);
                        closeContextMenu();
                      }}
                    >
                      <ChevronUp size={14} /> Move Up
                    </button>
                  )}
                  {canMoveDown && (
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-aki-border flex items-center gap-2"
                      onClick={() => {
                        setSortOption('created');
                        reorderRequests(contextMenu.collectionId, contextMenu.folderId || null, requestIndex, requestIndex + 1);
                        closeContextMenu();
                      }}
                    >
                      <ChevronDown size={14} /> Move Down
                    </button>
                  )}
                  {(canMoveUp || canMoveDown) && <hr className="my-1 border-aki-border" />}
                  <button
                    className="w-full px-3 py-2 text-left text-sm hover:bg-aki-border flex items-center gap-2"
                    onClick={() => {
                      duplicateRequest(contextMenu.collectionId, contextMenu.requestId!);
                      closeContextMenu();
                    }}
                  >
                    <Copy size={14} /> Duplicate
                  </button>
                  <button
                    className="w-full px-3 py-2 text-left text-sm hover:bg-aki-border flex items-center gap-2"
                    onClick={() => {
                      // Find the request to edit
                      const collection = collections.find(c => c.id === contextMenu.collectionId);
                      if (collection) {
                        const findRequest = (folders: typeof collection.folders, requests: typeof collection.requests): ApiRequest | null => {
                          // Check in root requests
                          const request = requests.find(r => r.id === contextMenu.requestId);
                          if (request) return request;

                          // Check in folders
                          for (const folder of folders) {
                            const folderRequest = findRequest(folder.folders, folder.requests);
                            if (folderRequest) return folderRequest;
                          }
                          return null;
                        };

                        const request = findRequest(collection.folders, collection.requests);
                        if (request) {
                          setEditingId(request.id);
                          setEditingName(request.name);
                          closeContextMenu();
                          setTimeout(() => inputRef.current?.focus(), 0);
                        }
                      }
                    }}
                  >
                    <Edit2 size={14} /> Rename
                  </button>
                  {collections.length > 1 && (
                    <div className="relative">
                      <button
                        className="w-full px-3 py-2 text-left text-sm hover:bg-aki-border flex items-center gap-2 justify-between"
                        onClick={() => setShowMoveToMenu(!showMoveToMenu)}
                      >
                        <span className="flex items-center gap-2">
                          <MoveRight size={14} /> Move to
                        </span>
                        <ChevronRight size={14} />
                      </button>
                      {showMoveToMenu && (
                        <div className="absolute left-full top-0 ml-1 bg-aki-card border border-aki-border rounded-lg shadow-xl py-1 min-w-[160px] z-50">
                          {collections
                            .filter(c => c.id !== contextMenu.collectionId)
                            .map(targetCollection => (
                              <button
                                key={targetCollection.id}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-aki-border flex items-center gap-2"
                                onClick={() => {
                                  moveRequest(
                                    contextMenu.collectionId,
                                    contextMenu.folderId || null,
                                    targetCollection.id,
                                    null,
                                    contextMenu.requestId!
                                  );
                                  closeContextMenu();
                                }}
                              >
                                <Folder size={14} className="text-yellow-400" />
                                <span className="truncate">{targetCollection.name}</span>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                  <hr className="my-1 border-aki-border" />
                  <button
                    className="w-full px-3 py-2 text-left text-sm hover:bg-aki-border flex items-center gap-2 text-red-400"
                    onClick={() => {
                      deleteRequest(contextMenu.collectionId, contextMenu.requestId!);
                      closeContextMenu();
                    }}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </>
              );
            })()}
          </div>
        </>
      )}

      {/* Auth Settings Modal */}
      {authModal && (
        <CollectionAuthModal
          isOpen={authModal.open}
          onClose={() => setAuthModal(null)}
          collectionId={authModal.collectionId}
          folderId={authModal.folderId}
        />
      )}
    </div>
  );
}

