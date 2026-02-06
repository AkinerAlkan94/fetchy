import { useState, useCallback, useEffect, useRef } from 'react';
import { HelpCircle, Settings, RefreshCw, PanelLeftClose, PanelLeftOpen, Rows, Columns } from 'lucide-react';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';
import RequestPanel from './components/RequestPanel';
import ResponsePanel from './components/ResponsePanel';
import WelcomeScreen from './components/WelcomeScreen';
import ImportModal from './components/ImportModal';
import ExportModal from './components/ExportModal';
import EnvironmentModal from './components/EnvironmentModal';
import EnvironmentDropdown from './components/EnvironmentDropdown';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import SettingsModal from './components/SettingsModal';
import UpdateModal from './components/UpdateModal';
import ThemeToggle from './components/ThemeToggle';
import ResizeHandle from './components/ResizeHandle';
import Tooltip from './components/Tooltip';
import { useAppStore } from './store/appStore';
import { usePreferencesStore } from './store/preferencesStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { ApiResponse, RequestHistoryItem, ApiRequest } from './types';

type ImportType = 'postman' | 'openapi' | 'curl';

function App() {
  const {
    tabs,
    activeTabId,
    sidebarWidth,
    sidebarCollapsed,
    toggleSidebar,
    collections,
    addCollection,
    addRequest,
    openTab,
    setSidebarWidth,
    requestPanelWidth,
    setRequestPanelWidth,
    panelLayout,
    togglePanelLayout,
  } = useAppStore();
  const { loadPreferences, preferences } = usePreferencesStore();
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [sentRequest, setSentRequest] = useState<ApiRequest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState<ImportType>('postman');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showEnvironmentModal, setShowEnvironmentModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const mainPanelRef = useRef<HTMLDivElement>(null);

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const activeTab = tabs.find(t => t.id === activeTabId);
  const hasActiveRequest = activeTab?.type === 'request';

  // Load history response/request when switching to a history tab
  useEffect(() => {
    if (activeTab?.isHistoryItem) {
      if (activeTab.historyResponse) {
        setResponse(activeTab.historyResponse);
      }
      if (activeTab.historyRequest) {
        setSentRequest(activeTab.historyRequest);
      }
    } else {
      // Clear response when switching to non-history tab
      // setResponse(null);
      // setSentRequest(null);
    }
  }, [activeTabId, activeTab?.isHistoryItem, activeTab?.historyResponse, activeTab?.historyRequest]);

  const handleHistoryItemClick = useCallback((item: RequestHistoryItem) => {
    // Open a new tab for the history item
    openTab({
      type: 'request',
      title: `${item.request.method} ${item.request.name || 'History'}`,
      isHistoryItem: true,
      historyRequest: item.request,
      historyResponse: item.response,
    });

    // Set response and sent request for display
    if (item.response) {
      setResponse(item.response);
    }
    setSentRequest(item.request);
  }, [openTab]);

  const handleNewRequest = useCallback(() => {
    if (collections.length === 0) {
      const collection = addCollection('My Collection');
      const request = addRequest(collection.id, null);
      openTab({
        type: 'request',
        title: request.name,
        requestId: request.id,
        collectionId: collection.id,
      });
    } else {
      const request = addRequest(collections[0].id, null);
      openTab({
        type: 'request',
        title: request.name,
        requestId: request.id,
        collectionId: collections[0].id,
      });
    }
  }, [collections, addCollection, addRequest, openTab]);

  const handleImport = useCallback((type?: ImportType) => {
    if (type) {
      setImportType(type);
    }
    setShowImportModal(true);
  }, []);

  // Resize handlers
  const handleSidebarResize = useCallback((delta: number) => {
    const newWidth = Math.max(200, Math.min(600, sidebarWidth + delta));
    setSidebarWidth(newWidth);
  }, [sidebarWidth, setSidebarWidth]);

  const handleRequestPanelResize = useCallback((delta: number) => {
    if (!mainPanelRef.current) return;

    if (panelLayout === 'horizontal') {
      const containerWidth = mainPanelRef.current.offsetWidth;
      const pixelWidth = (requestPanelWidth / 100) * containerWidth;
      const newPixelWidth = Math.max(200, Math.min(containerWidth - 200, pixelWidth + delta));
      const newPercentage = (newPixelWidth / containerWidth) * 100;
      setRequestPanelWidth(newPercentage);
    } else {
      // Vertical layout
      const containerHeight = mainPanelRef.current.offsetHeight - 40; // Subtract TabBar height
      const pixelHeight = (requestPanelWidth / 100) * containerHeight;
      const newPixelHeight = Math.max(150, Math.min(containerHeight - 150, pixelHeight + delta));
      const newPercentage = (newPixelHeight / containerHeight) * 100;
      setRequestPanelWidth(newPercentage);
    }
  }, [requestPanelWidth, setRequestPanelWidth, panelLayout]);

  // Set up keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'n',
      ctrl: true,
      handler: handleNewRequest,
      description: 'New request',
    },
    {
      key: 'i',
      ctrl: true,
      handler: () => handleImport(),
      description: 'Import',
    },
    {
      key: 'e',
      ctrl: true,
      handler: () => setShowEnvironmentModal(true),
      description: 'Environments',
    },
    {
      key: '/',
      ctrl: true,
      handler: () => setShowShortcutsModal(true),
      description: 'Keyboard shortcuts',
    },
  ]);

  return (
    <div className="h-screen w-screen flex flex-col bg-aki-bg overflow-hidden">
      {/* Top bar */}
      <div className="h-12 bg-aki-sidebar border-b border-aki-border flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-3">
          <img src="./logo.jpg" alt="Fetchy" className="h-8 w-8 rounded" />
          <div className="text-xl font-bold text-aki-accent">Fetchy</div>
          <span className="text-xs text-aki-text-muted italic">Local by design. Reliable by nature</span>
          <span className="text-xs text-aki-text-muted">v1.1.0</span>
        </div>
        <div className="flex items-center gap-2">
          <EnvironmentDropdown onOpenSettings={() => setShowEnvironmentModal(true)} />
          <Tooltip content="Settings">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 hover:bg-aki-border rounded text-aki-text-muted hover:text-aki-text"
            >
              <Settings size={18} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div
          style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
          className="shrink-0 transition-all duration-200 overflow-hidden"
        >
          <Sidebar
            onImport={() => handleImport()}
            onHistoryItemClick={handleHistoryItemClick}
          />
        </div>

        {/* Sidebar resize handle */}
        {!sidebarCollapsed && (
          <ResizeHandle
            direction="horizontal"
            onResize={handleSidebarResize}
          />
        )}

        {/* Main panel */}
        <div className="flex-1 flex flex-col overflow-hidden" ref={mainPanelRef}>
          {/* Tab bar */}
          <TabBar />

          {/* Request/Response area */}
          {hasActiveRequest ? (
            <div className={`flex-1 flex overflow-hidden ${panelLayout === 'vertical' ? 'flex-col' : ''}`}>
              {/* Request panel */}
              <div
                style={panelLayout === 'horizontal'
                  ? { width: `${requestPanelWidth}%` }
                  : { height: `${requestPanelWidth}%` }
                }
                className="shrink-0 overflow-hidden"
              >
                <RequestPanel
                  setResponse={setResponse}
                  setSentRequest={setSentRequest}
                  setIsLoading={setIsLoading}
                  isLoading={isLoading}
                />
              </div>

              {/* Request/Response resize handle */}
              <ResizeHandle
                direction={panelLayout === 'horizontal' ? 'horizontal' : 'vertical'}
                onResize={handleRequestPanelResize}
              />

              {/* Response panel */}
              <div className="flex-1 overflow-hidden">
                <ResponsePanel
                  response={response}
                  sentRequest={sentRequest}
                  isLoading={isLoading}
                />
              </div>
            </div>
          ) : (
            <WelcomeScreen onImport={handleImport} />
          )}
        </div>
      </div>

      {/* Bottom bar with toggle buttons */}
      <div className="h-10 bg-aki-sidebar border-t border-aki-border flex items-center px-4 gap-2 shrink-0">
        <Tooltip content={sidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}>
          <button
            onClick={toggleSidebar}
            className="p-2 hover:bg-aki-border rounded text-aki-text-muted hover:text-aki-text"
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </Tooltip>

        {hasActiveRequest && (
          <Tooltip content={panelLayout === 'horizontal' ? "Switch to Vertical Layout" : "Switch to Horizontal Layout"}>
            <button
              onClick={togglePanelLayout}
              className="p-2 hover:bg-aki-border rounded text-aki-text-muted hover:text-aki-text"
            >
              {panelLayout === 'horizontal' ? <Rows size={18} /> : <Columns size={18} />}
            </button>
          </Tooltip>
        )}

        <div className="flex-1" />

        <ThemeToggle />

        <Tooltip content="Check for Updates">
          <button
            onClick={() => setShowUpdateModal(true)}
            className="p-2 hover:bg-aki-border rounded text-aki-text-muted hover:text-aki-text"
          >
            <RefreshCw size={18} />
          </button>
        </Tooltip>

        <Tooltip content="Keyboard Shortcuts (Ctrl+/)">
          <button
            onClick={() => setShowShortcutsModal(true)}
            className="p-2 hover:bg-aki-border rounded text-aki-text-muted hover:text-aki-text"
          >
            <HelpCircle size={18} />
          </button>
        </Tooltip>
      </div>

      {/* Modals */}
      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          initialImportType={importType}
        />
      )}

      {showExportModal && (
        <ExportModal onClose={() => setShowExportModal(false)} />
      )}

      {showEnvironmentModal && (
        <EnvironmentModal onClose={() => setShowEnvironmentModal(false)} />
      )}

      {showShortcutsModal && (
        <KeyboardShortcutsModal onClose={() => setShowShortcutsModal(false)} />
      )}

      {showSettingsModal && (
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {showUpdateModal && (
        <UpdateModal
          onClose={() => setShowUpdateModal(false)}
        />
      )}
    </div>
  );
}

export default App;
