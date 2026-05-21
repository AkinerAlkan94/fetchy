// @vitest-environment jsdom

/**
 * GH-72: Tooltip missing for long named collections
 * Tests that the `title` attribute is correctly set on the name <span>
 * in SortableCollectionItem, SortableFolderItem, and SortableRequestItem.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import SortableCollectionItem from '../../../src/components/sidebar/SortableCollectionItem';
import SortableFolderItem from '../../../src/components/sidebar/SortableFolderItem';
import SortableRequestItem from '../../../src/components/sidebar/SortableRequestItem';
import type { Collection, RequestFolder, ApiRequest } from '../../../src/types';

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
    isOver: false,
  })),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

vi.mock('../../../src/utils/helpers', () => ({
  getMethodBgColor: vi.fn(() => 'bg-blue-500'),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeCollection(overrides?: Partial<Collection>): Collection {
  return {
    id: 'col-1',
    name: 'My Long Collection Name',
    requests: [],
    folders: [],
    variables: [],
    expanded: false,
    ...overrides,
  };
}

function makeFolder(overrides?: Partial<RequestFolder>): RequestFolder {
  return {
    id: 'folder-1',
    name: 'My Long Folder Name',
    requests: [],
    folders: [],
    expanded: false,
    ...overrides,
  };
}

function makeRequest(overrides?: Partial<ApiRequest>): ApiRequest {
  return {
    id: 'req-1',
    name: 'My Long Request Name',
    method: 'GET',
    url: 'https://api.example.com/users',
    headers: [],
    params: [],
    body: { type: 'none' },
    auth: { type: 'none' },
    preScript: '',
    script: '',
    ...overrides,
  };
}

const collectionProps = {
  onToggle: vi.fn(),
  onContextMenu: vi.fn(),
  editingId: null,
  editingName: '',
  setEditingName: vi.fn(),
  inputRef: { current: null } as React.RefObject<HTMLInputElement>,
  onEditComplete: vi.fn(),
};

const folderProps = {
  collectionId: 'col-1',
  depth: 1,
  onToggle: vi.fn(),
  onContextMenu: vi.fn(),
  editingId: null,
  editingName: '',
  setEditingName: vi.fn(),
  inputRef: { current: null } as React.RefObject<HTMLInputElement>,
  onEditComplete: vi.fn(),
};

const requestProps = {
  collectionId: 'col-1',
  depth: 1,
  onClick: vi.fn(),
  onContextMenu: vi.fn(),
  editingId: null,
  editingName: '',
  setEditingName: vi.fn(),
  inputRef: { current: null } as React.RefObject<HTMLInputElement>,
  onEditComplete: vi.fn(),
  isActive: false,
  isHighlighted: false,
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe('GH-72: title attribute on sidebar name spans', () => {
  describe('SortableCollectionItem', () => {
    it('renders name span with title equal to the collection name', () => {
      const name = 'My Long Collection Name';
      render(
        <SortableCollectionItem collection={makeCollection({ name })} {...collectionProps}>
          <div />
        </SortableCollectionItem>
      );
      const span = screen.getByText(name);
      expect(span.getAttribute('title')).toBe(name);
    });

    it('title attribute updates when collection name changes', () => {
      const name = 'Another Very Long Collection Name That Would Overflow';
      render(
        <SortableCollectionItem collection={makeCollection({ name })} {...collectionProps}>
          <div />
        </SortableCollectionItem>
      );
      const span = screen.getByText(name);
      expect(span.getAttribute('title')).toBe(name);
    });

    it('does not render name span with title when in editing mode', () => {
      const name = 'My Collection';
      render(
        <SortableCollectionItem
          collection={makeCollection({ name })}
          {...collectionProps}
          editingId="col-1"
          editingName={name}
        >
          <div />
        </SortableCollectionItem>
      );
      // In editing mode an <input> is shown instead of the <span>
      const input = document.querySelector('input');
      expect(input).toBeTruthy();
      // The name span with title should not be present
      const spans = Array.from(document.querySelectorAll('span')).filter(
        (s) => s.getAttribute('title') === name
      );
      expect(spans.length).toBe(0);
    });
  });

  describe('SortableFolderItem', () => {
    it('renders name span with title equal to the folder name', () => {
      const name = 'My Long Folder Name';
      render(
        <SortableFolderItem folder={makeFolder({ name })} {...folderProps}>
          <div />
        </SortableFolderItem>
      );
      const span = screen.getByText(name);
      expect(span.getAttribute('title')).toBe(name);
    });

    it('title attribute updates when folder name changes', () => {
      const name = 'Another Very Long Folder Name That Would Overflow';
      render(
        <SortableFolderItem folder={makeFolder({ name })} {...folderProps}>
          <div />
        </SortableFolderItem>
      );
      const span = screen.getByText(name);
      expect(span.getAttribute('title')).toBe(name);
    });

    it('does not render name span with title when in editing mode', () => {
      const name = 'My Folder';
      render(
        <SortableFolderItem
          folder={makeFolder({ name })}
          {...folderProps}
          editingId="folder-1"
          editingName={name}
        >
          <div />
        </SortableFolderItem>
      );
      const input = document.querySelector('input');
      expect(input).toBeTruthy();
      const spans = Array.from(document.querySelectorAll('span')).filter(
        (s) => s.getAttribute('title') === name
      );
      expect(spans.length).toBe(0);
    });
  });

  describe('SortableRequestItem', () => {
    it('renders name span with title equal to the request name', () => {
      const name = 'My Long Request Name';
      render(
        <SortableRequestItem request={makeRequest({ name })} {...requestProps} />
      );
      const span = screen.getByText(name);
      expect(span.getAttribute('title')).toBe(name);
    });

    it('title attribute updates when request name changes', () => {
      const name = 'POST Create Very Long Named API Endpoint';
      render(
        <SortableRequestItem
          request={makeRequest({ name, method: 'POST' })}
          {...requestProps}
        />
      );
      const span = screen.getByText(name);
      expect(span.getAttribute('title')).toBe(name);
    });

    it('does not render name span with title when in editing mode', () => {
      const name = 'My Request';
      render(
        <SortableRequestItem
          request={makeRequest({ name })}
          {...requestProps}
          editingId="req-1"
          editingName={name}
        />
      );
      const input = document.querySelector('input');
      expect(input).toBeTruthy();
      const spans = Array.from(document.querySelectorAll('span')).filter(
        (s) => s.getAttribute('title') === name
      );
      expect(spans.length).toBe(0);
    });
  });
});
