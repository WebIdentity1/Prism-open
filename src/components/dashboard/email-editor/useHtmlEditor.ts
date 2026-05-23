import { useCallback, useRef } from "react";

const MAX_UNDO = 20;

/**
 * Resolve an element path like "table>tbody>tr:nth-of-type(2)>td>h1"
 * starting from doc.body.
 */
export function resolveElementPath(
  doc: Document,
  path: string
): Element | null {
  const segments = path.split(">");
  let current: Element = doc.body;

  for (const segment of segments) {
    const match = segment.match(/^(\w+)(?::nth-of-type\((\d+)\))?$/);
    if (!match) return null;

    const [, tag, indexStr] = match;
    const index = indexStr ? parseInt(indexStr, 10) - 1 : 0;
    const children = Array.from(current.children).filter(
      (c) => c.tagName.toLowerCase() === tag.toLowerCase()
    );

    if (!children[index]) return null;
    current = children[index];
  }

  return current;
}

/**
 * Parse the HTML string, find the element at the given path,
 * apply a mutation, and return the updated HTML string.
 * Returns the original HTML if the element is not found.
 */
export function applyEdit(
  html: string,
  elementPath: string,
  mutator: (element: Element) => void
): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const element = resolveElementPath(doc, elementPath);
  if (!element) {
    console.warn("useHtmlEditor: could not find element at path:", elementPath);
    return html;
  }

  mutator(element);

  // Reconstruct the full HTML string, preserving doctype if present
  const doctype = doc.doctype
    ? `<!DOCTYPE ${doc.doctype.name}>`
    : "";
  return doctype + doc.documentElement.outerHTML;
}

/**
 * Apply inline style changes to an element.
 */
function applyStyles(el: Element, styles: Record<string, string>) {
  const htmlEl = el as HTMLElement;
  for (const [prop, value] of Object.entries(styles)) {
    htmlEl.style.setProperty(prop, value);
  }
}

/**
 * Hook that provides HTML editing operations with undo support.
 *
 * IMPORTANT: Each method reads the current `html` from the closure and
 * calls `setHtml` exactly once.  Never chain two update methods in the
 * same synchronous tick — the second call would read stale state.
 * Use the combined parameters (e.g. the `styles` argument on updateText)
 * to apply multiple mutations in a single pass.
 */
export function useHtmlEditor(
  html: string,
  setHtml: (html: string) => void
) {
  const historyRef = useRef<string[]>([]);

  const pushHistory = useCallback(() => {
    if (!html) return;
    historyRef.current = [
      ...historyRef.current.slice(-(MAX_UNDO - 1)),
      html,
    ];
  }, [html]);

  const undo = useCallback(() => {
    const history = historyRef.current;
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    historyRef.current = history.slice(0, -1);
    setHtml(previous);
  }, [setHtml]);

  /** Update text content and optionally inline styles in one pass. */
  const updateText = useCallback(
    (elementPath: string, newText: string, styles?: Record<string, string>) => {
      pushHistory();
      const result = applyEdit(html, elementPath, (el) => {
        el.textContent = newText;
        if (styles) applyStyles(el, styles);
      });
      setHtml(result);
    },
    [html, setHtml, pushHistory]
  );

  const updateImageSrc = useCallback(
    (elementPath: string, newSrc: string, newAlt?: string) => {
      pushHistory();
      const result = applyEdit(html, elementPath, (el) => {
        el.setAttribute("src", newSrc);
        if (newAlt !== undefined) {
          el.setAttribute("alt", newAlt);
        }
      });
      setHtml(result);
    },
    [html, setHtml, pushHistory]
  );

  /** Update link href, optionally text, and optionally inline styles in one pass. */
  const updateHref = useCallback(
    (elementPath: string, newHref: string, newText?: string, styles?: Record<string, string>) => {
      pushHistory();
      const result = applyEdit(html, elementPath, (el) => {
        // The element might be the <a> itself or a child inside an <a>
        const anchor =
          el.tagName === "A" ? el : el.closest("a");
        if (anchor) {
          anchor.setAttribute("href", newHref);
        }
        if (newText !== undefined) {
          el.textContent = newText;
        }
        if (styles) applyStyles(el, styles);
      });
      setHtml(result);
    },
    [html, setHtml, pushHistory]
  );

  const updateStyle = useCallback(
    (elementPath: string, styles: Record<string, string>) => {
      pushHistory();
      const result = applyEdit(html, elementPath, (el) => {
        applyStyles(el, styles);
      });
      setHtml(result);
    },
    [html, setHtml, pushHistory]
  );

  const clearHistory = useCallback(() => {
    historyRef.current = [];
  }, []);

  return {
    updateText,
    updateImageSrc,
    updateHref,
    updateStyle,
    undo,
    clearHistory,
    canUndo: historyRef.current.length > 0,
  };
}
