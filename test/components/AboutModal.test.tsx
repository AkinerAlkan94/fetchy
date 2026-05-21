// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AboutModal from '../../src/components/AboutModal';

beforeEach(() => {
  vi.stubGlobal('__APP_VERSION__', '1.0.0');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AboutModal', () => {
  it('renders without crashing when mounted', () => {
    render(<AboutModal onClose={vi.fn()} />);
    expect(screen.getByText('About Fetchy')).toBeTruthy();
  });

  it('does not show content when component is not mounted (isOpen=false equivalent)', () => {
    const { unmount } = render(<AboutModal onClose={vi.fn()} />);
    unmount();
    expect(screen.queryByText('About Fetchy')).toBeNull();
  });

  it('calls onClose when the close (X) button is clicked', () => {
    const onClose = vi.fn();
    render(<AboutModal onClose={onClose} />);
    const closeBtns = screen.getAllByRole('button', { name: 'Close' });
    fireEvent.click(closeBtns[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('displays the "About Fetchy" heading', () => {
    render(<AboutModal onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'About Fetchy' })).toBeTruthy();
  });

  it('displays MIT License text', () => {
    render(<AboutModal onClose={vi.fn()} />);
    const licenseElements = screen.getAllByText('MIT License');
    expect(licenseElements.length).toBeGreaterThan(0);
  });

  it('renders at least one open source dependency item', () => {
    render(<AboutModal onClose={vi.fn()} />);
    // React is the first entry in OPEN_SOURCE_DEPS
    expect(screen.getByText('React')).toBeTruthy();
  });

  it('calls onClose when Escape key is pressed on the modal backdrop', () => {
    const onClose = vi.fn();
    const { container } = render(<AboutModal onClose={onClose} />);
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.keyDown(backdrop, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
