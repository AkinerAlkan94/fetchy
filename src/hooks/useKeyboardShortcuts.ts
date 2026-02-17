import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';

interface ShortcutHandler {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  description: string;
}

export function useKeyboardShortcuts(additionalShortcuts?: ShortcutHandler[]) {
  const {
    tabs,
    activeTabId,
    closeTab,
    setActiveTab,
  } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for additional shortcuts first
      if (additionalShortcuts) {
        for (const shortcut of additionalShortcuts) {
          if (
            e.key.toLowerCase() === shortcut.key.toLowerCase() &&
            !!e.ctrlKey === !!shortcut.ctrl &&
            !!e.shiftKey === !!shortcut.shift &&
            !!e.altKey === !!shortcut.alt
          ) {
            e.preventDefault();
            shortcut.handler();
            return;
          }
        }
      }

      // Close current tab: Ctrl+W
      if (e.ctrlKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (activeTabId) {
          closeTab(activeTabId);
        }
        return;
      }

      // Switch tabs with Ctrl+Tab / Ctrl+Shift+Tab
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        const currentIndex = tabs.findIndex(t => t.id === activeTabId);
        if (currentIndex === -1 || tabs.length <= 1) return;

        let newIndex: number;
        if (e.shiftKey) {
          // Previous tab
          newIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
        } else {
          // Next tab
          newIndex = currentIndex === tabs.length - 1 ? 0 : currentIndex + 1;
        }
        setActiveTab(tabs[newIndex].id);
        return;
      }

      // Switch to specific tab with Ctrl+1-9
      if (e.ctrlKey && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        const tabIndex = parseInt(e.key) - 1;
        if (tabIndex < tabs.length) {
          setActiveTab(tabs[tabIndex].id);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, tabs, closeTab, setActiveTab, additionalShortcuts]);
}

// Available shortcuts for reference (used by KeyboardShortcutsModal)
export const keyboardShortcuts = [
  { keys: 'Ctrl+S', description: 'Save current request' },
  { keys: 'Ctrl+Enter / Shift+Enter', description: 'Send request' },
  { keys: 'Ctrl+W', description: 'Close current tab' },
  { keys: 'Ctrl+Tab', description: 'Next tab' },
  { keys: 'Ctrl+Shift+Tab', description: 'Previous tab' },
  { keys: 'Ctrl+1-9', description: 'Switch to tab 1-9' },
  { keys: 'Ctrl+N', description: 'New request' },
  { keys: 'Ctrl+I', description: 'Import collection' },
  { keys: 'Ctrl+E', description: 'Open environments' },
  { keys: 'Ctrl+/', description: 'Show keyboard shortcuts' },
];

