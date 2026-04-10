import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'p', 'a', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'strong', 'b', 'em', 'i', 'u', 'br', 'hr', 'div', 'span',
  'figure', 'figcaption', 'blockquote', 'pre', 'code', 'sup', 'sub',
];

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'target', 'rel', 'loading',
  'width', 'height', 'class', 'style', 'colspan', 'rowspan',
  'data-src', 'srcset', 'sizes',
];

export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') return html; // SSR fallback
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}
