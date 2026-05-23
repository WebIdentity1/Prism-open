import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import type { ElementSelection } from "./types";

/** JavaScript injected into the iframe srcDoc to enable click-to-edit. */
const IFRAME_EDIT_SCRIPT = `
(function() {
  var EDITABLE = {H1:1,H2:1,H3:1,H4:1,P:1,SPAN:1,A:1,TD:1,LI:1,STRONG:1,EM:1,IMG:1};

  function getPath(el) {
    var parts = [];
    var cur = el;
    while (cur && cur !== document.body) {
      var tag = cur.tagName.toLowerCase();
      var parent = cur.parentElement;
      if (parent) {
        var sibs = [];
        for (var i = 0; i < parent.children.length; i++) {
          if (parent.children[i].tagName === cur.tagName) sibs.push(parent.children[i]);
        }
        var idx = sibs.indexOf(cur);
        parts.unshift(sibs.length > 1 ? tag + ':nth-of-type(' + (idx + 1) + ')' : tag);
      }
      cur = parent;
    }
    return parts.join('>');
  }

  function findEditable(el) {
    var cur = el;
    while (cur && cur !== document.body) {
      if (EDITABLE[cur.tagName]) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  var last = null;
  document.body.addEventListener('mousemove', function(e) {
    var t = findEditable(e.target);
    if (last && last !== t) { last.style.outline = ''; last.style.outlineOffset = ''; last.style.cursor = ''; }
    if (t) {
      t.style.outline = '2px solid #6366f1';
      t.style.outlineOffset = '2px';
      t.style.cursor = 'pointer';
      last = t;
    }
  });

  document.body.addEventListener('mouseleave', function() {
    if (last) { last.style.outline = ''; last.style.outlineOffset = ''; last.style.cursor = ''; last = null; }
  });

  document.body.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    var t = findEditable(e.target);
    if (!t) return;
    var isImg = t.tagName === 'IMG';
    var anchorEl = t.tagName === 'A' ? t : t.closest ? t.closest('a') : null;
    var cs = window.getComputedStyle(t);
    window.parent.postMessage({
      type: 'prism-element-selected',
      elementPath: getPath(t),
      elementType: isImg ? 'image' : (anchorEl ? 'link' : 'text'),
      currentValue: isImg ? t.src : t.textContent,
      currentHref: anchorEl ? anchorEl.href : undefined,
      styles: {
        color: t.style.color || cs.color,
        backgroundColor: t.style.backgroundColor || cs.backgroundColor,
        fontSize: t.style.fontSize || cs.fontSize,
        fontWeight: t.style.fontWeight || cs.fontWeight
      }
    }, '*');
  }, true);
})();
`;

interface EditableIframeProps {
  html: string;
  editMode: boolean;
  previewMode: "desktop" | "mobile";
  onElementSelected: (selection: ElementSelection) => void;
}

export function EditableIframe({
  html,
  editMode,
  previewMode,
  onElementSelected,
}: EditableIframeProps) {
  // Counter forces a fresh iframe mount whenever edit mode toggles.
  // Changing the `sandbox` attribute on an existing iframe does NOT cause
  // the browser to re-evaluate the document, so the injected script would
  // never run.  Keying the iframe on this value destroys the old one and
  // creates a new one with the correct sandbox + srcDoc from the start.
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    setIframeKey((k) => k + 1);
  }, [editMode]);

  // Inject the edit script when edit mode is active
  const enhancedHtml = useMemo(() => {
    if (!html || !editMode) return html;
    const scriptTag = `<script>${IFRAME_EDIT_SCRIPT}</` + "script>";
    if (html.includes("</body>")) {
      return html.replace("</body>", `${scriptTag}</body>`);
    }
    return html + scriptTag;
  }, [html, editMode]);

  // Listen for postMessage from the iframe.
  // We use a unique message type ("prism-element-selected") rather than
  // validating event.source, because srcDoc iframes report a null origin and
  // event.source can be unreliable across browsers.
  const editModeRef = useRef(editMode);
  editModeRef.current = editMode;

  const onElementSelectedRef = useRef(onElementSelected);
  onElementSelectedRef.current = onElementSelected;

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!editModeRef.current) return;
      const data = event.data;
      if (data?.type !== "prism-element-selected") return;

      onElementSelectedRef.current({
        elementPath: data.elementPath,
        elementType: data.elementType,
        currentValue: data.currentValue || "",
        currentHref: data.currentHref,
        styles: data.styles || {},
      });
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <div
      className="bg-white rounded-xl shadow-lg overflow-hidden mx-auto glass"
      style={{
        width: previewMode === "mobile" ? 375 : 620,
        maxHeight: "100%",
        overflow: "auto",
      }}
    >
      <iframe
        key={iframeKey}
        srcDoc={enhancedHtml || ""}
        title="Email Preview"
        className="w-full border-0"
        style={{ minHeight: 600, width: "100%" }}
        sandbox={
          editMode
            ? "allow-same-origin allow-scripts"
            : "allow-same-origin"
        }
      />
    </div>
  );
}
