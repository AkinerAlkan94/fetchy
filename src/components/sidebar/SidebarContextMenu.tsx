import {
  FilePlus,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Folder,
  Trash2,
  Edit2,
  Copy,
  Upload,
  Key,
  MoveRight,
  Play,
  Settings,
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { RequestFolder, ApiRequest } from '../../types';
import { exportToPostman } from '../../utils/helpers';
import type { ContextMenuState, SortOption } from './types';

interface SidebarContextMenuProps {
  contextMenu: ContextMenuState;
  closeContextMenu: () => void;
  showMoveToMenu: boolean;
  setShowMoveToMenu: (show: boolean) => void;
  setRunCollectionModal: (modal: { open: boolean; collectionId: string } | null) => void;
  setAuthModal: (modal: { open: boolean; collectionId: string; folderId?: string } | null) => void;
  setEditingId: (id: string | null) => void;
  setEditingName: (name: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  setSortOption: (option: SortOption) => void;
}

function findFolderById(folders: RequestFolder[], folderId: string): RequestFolder | null {
  for (const folder of folders) {
    if (folder.id === folderId) return folder;
    const found = findFolderById(folder.folders, folderId);
    if (found) return found;
  }
  return null;
}

export default function SidebarContextMenu({
  contextMenu,
  closeContextMenu,
  showMoveToMenu,
  setShowMoveToMenu,
  setRunCollectionModal,
  setAuthModal,
  setEditingId,
  setEditingName,
  inputRef,
  setSortOption,
}: SidebarContextMenuProps) {
  const {
    collections,
    addRequest,
    addFolder,
    deleteCollection,
    deleteFolder,
    deleteRequest,
    duplicateRequest,
    moveRequest,
    moveFolder,
    reorderRequests,
    openTab,
  } = useAppStore();

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

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={closeContextMenu} />
      <div
        className="context-menu fixed z-50 bg-fetchy-dropdown border border-fetchy-border rounded-lg shadow-xl py-1 min-w-[160px]"
        style={{ left: contextMenu.x, top: contextMenu.y }}
      >
        {contextMenu.type === 'collection' && (
          <>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
              onClick={() => {
                setRunCollectionModal({ open: true, collectionId: contextMenu.collectionId });
                closeContextMenu();
              }}
            >
              <Play size={14} /> Run Collection
            </button>
            <hr className="my-1 border-fetchy-border" />
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
              onClick={() => {
                addRequest(contextMenu.collectionId, null);
                closeContextMenu();
              }}
            >
              <FilePlus size={14} /> Add Request
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
              onClick={() => {
                addFolder(contextMenu.collectionId, null, 'New Folder');
                closeContextMenu();
              }}
            >
              <FolderPlus size={14} /> Add Folder
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
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
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
              onClick={() => {
                handleExportCollection(contextMenu.collectionId);
                closeContextMenu();
              }}
            >
              <Upload size={14} /> Export to Postman
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
              onClick={() => {
                setAuthModal({ open: true, collectionId: contextMenu.collectionId });
                closeContextMenu();
              }}
            >
              <Key size={14} /> Auth Settings
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
              onClick={() => {
                openTab({
                  type: 'collection',
                  title: collections.find(c => c.id === contextMenu.collectionId)?.name || 'Collection',
                  collectionId: contextMenu.collectionId,
                });
                closeContextMenu();
              }}
            >
              <Settings size={14} /> Configure
            </button>
            <hr className="my-1 border-fetchy-border" />
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2 text-red-400"
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
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
              onClick={() => {
                addRequest(contextMenu.collectionId, contextMenu.folderId!);
                closeContextMenu();
              }}
            >
              <FilePlus size={14} /> Add Request
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
              onClick={() => {
                addFolder(contextMenu.collectionId, contextMenu.folderId!, 'New Folder');
                closeContextMenu();
              }}
            >
              <FolderPlus size={14} /> Add Subfolder
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
              onClick={() => {
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
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
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
                  className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2 justify-between"
                  onClick={() => setShowMoveToMenu(!showMoveToMenu)}
                >
                  <span className="flex items-center gap-2">
                    <MoveRight size={14} /> Move to
                  </span>
                  <ChevronRight size={14} />
                </button>
                {showMoveToMenu && (
                  <div className="absolute left-full top-0 ml-1 bg-fetchy-dropdown border border-fetchy-border rounded-lg shadow-xl py-1 min-w-[160px] z-50">
                    {collections
                      .filter(c => c.id !== contextMenu.collectionId)
                      .map(targetCollection => (
                        <button
                          key={targetCollection.id}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
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
            <hr className="my-1 border-fetchy-border" />
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2 text-red-400"
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
                  className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
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
                  className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
                  onClick={() => {
                    setSortOption('created');
                    reorderRequests(contextMenu.collectionId, contextMenu.folderId || null, requestIndex, requestIndex + 1);
                    closeContextMenu();
                  }}
                >
                  <ChevronDown size={14} /> Move Down
                </button>
              )}
              {(canMoveUp || canMoveDown) && <hr className="my-1 border-fetchy-border" />}
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
                onClick={() => {
                  duplicateRequest(contextMenu.collectionId, contextMenu.requestId!);
                  closeContextMenu();
                }}
              >
                <Copy size={14} /> Duplicate
              </button>
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
                onClick={() => {
                  const collection = collections.find(c => c.id === contextMenu.collectionId);
                  if (collection) {
                    const findRequest = (folders: typeof collection.folders, requests: typeof collection.requests): ApiRequest | null => {
                      const request = requests.find(r => r.id === contextMenu.requestId);
                      if (request) return request;
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
                    className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2 justify-between"
                    onClick={() => setShowMoveToMenu(!showMoveToMenu)}
                  >
                    <span className="flex items-center gap-2">
                      <MoveRight size={14} /> Move to
                    </span>
                    <ChevronRight size={14} />
                  </button>
                  {showMoveToMenu && (
                    <div className="absolute left-full top-0 ml-1 bg-fetchy-dropdown border border-fetchy-border rounded-lg shadow-xl py-1 min-w-[160px] z-50">
                      {collections
                        .filter(c => c.id !== contextMenu.collectionId)
                        .map(targetCollection => (
                          <button
                            key={targetCollection.id}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2"
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
              <hr className="my-1 border-fetchy-border" />
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-fetchy-border flex items-center gap-2 text-red-400"
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
  );
}
