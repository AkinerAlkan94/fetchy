// HtmlDescription Component - Safely renders HTML descriptions from OpenAPI specs

import { useMemo } from 'react';

interface HtmlDescriptionProps {
  html: string;
  className?: string;
}

// Helper component to render HTML descriptions safely
// Supports common HTML elements including tables from OpenAPI descriptions
export const HtmlDescription: React.FC<HtmlDescriptionProps> = ({ html, className = '' }) => {
  // Basic sanitization - only allow safe HTML tags
  const sanitizeHtml = (dirty: string): string => {
    // Create a temporary element to parse HTML
    const doc = new DOMParser().parseFromString(dirty, 'text/html');

    // List of allowed tags
    const allowedTags = new Set([
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'code', 'pre',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
      'ul', 'ol', 'li', 'a', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'hr', 'sup', 'sub', 'dl', 'dt', 'dd'
    ]);

    // List of allowed attributes
    const allowedAttrs = new Set(['href', 'target', 'rel', 'class', 'colspan', 'rowspan', 'scope']);

    const sanitizeNode = (node: Node): Node | null => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.cloneNode(true);
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const tagName = el.tagName.toLowerCase();

        if (!allowedTags.has(tagName)) {
          // Return text content for disallowed tags
          const fragment = document.createDocumentFragment();
          el.childNodes.forEach(child => {
            const sanitized = sanitizeNode(child);
            if (sanitized) fragment.appendChild(sanitized);
          });
          return fragment;
        }

        // Create new element with only allowed attributes
        const newEl = document.createElement(tagName);

        // Copy allowed attributes
        for (const attr of Array.from(el.attributes)) {
          if (allowedAttrs.has(attr.name.toLowerCase())) {
            // Special handling for links - add security attributes
            if (attr.name === 'href') {
              const href = attr.value;
              // Only allow http, https, and relative URLs
              if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('/') || href.startsWith('#')) {
                newEl.setAttribute('href', href);
                newEl.setAttribute('target', '_blank');
                newEl.setAttribute('rel', 'noopener noreferrer');
              }
            } else {
              newEl.setAttribute(attr.name, attr.value);
            }
          }
        }

        // Recursively sanitize children
        el.childNodes.forEach(child => {
          const sanitized = sanitizeNode(child);
          if (sanitized) newEl.appendChild(sanitized);
        });

        return newEl;
      }

      return null;
    };

    const fragment = document.createDocumentFragment();
    doc.body.childNodes.forEach(child => {
      const sanitized = sanitizeNode(child);
      if (sanitized) fragment.appendChild(sanitized);
    });

    const temp = document.createElement('div');
    temp.appendChild(fragment);
    return temp.innerHTML;
  };

  const sanitizedHtml = useMemo(() => sanitizeHtml(html), [html]);

  return (
    <span
      className={`openapi-description ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};

