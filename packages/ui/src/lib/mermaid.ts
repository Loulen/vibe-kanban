import mermaid from 'mermaid';

let isInitialized = false;
let renderCount = 0;

function ensureMermaidInitialized() {
  if (isInitialized) return;

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'default',
    suppressErrorRendering: true,
  });

  isInitialized = true;
}

const renderCache = new Map<string, Promise<string>>();

export async function renderMermaidToSvg(code: string): Promise<string> {
  ensureMermaidInitialized();

  const cached = renderCache.get(code);
  if (cached) {
    console.debug('[mermaid] cache hit for render', { id: 'cached', codeLength: code.length });
    return cached;
  }

  renderCount += 1;
  const id = `vk-mermaid-${renderCount}`;

  console.debug('[mermaid] rendering diagram', { id, codeLength: code.length });

  // Let mermaid render into document.body (it needs attached DOM for layout).
  // suppressErrorRendering: true prevents error elements from persisting.
  // Clean up the temporary wrapper div mermaid creates after render completes.
  const promise = mermaid
    .render(id, code)
    .then(({ svg }) => {
      console.debug('[mermaid] render succeeded', { id, svgLength: svg.length });
      return svg;
    })
    .finally(() => {
      // Remove the temporary enclosing div that mermaid appends to <body>
      document.getElementById(`d${id}`)?.remove();
    });

  renderCache.set(code, promise);

  // On failure, remove from cache so a retry with different code can work
  promise.catch((err) => {
    console.warn('[mermaid] render failed, evicting from cache', { id, error: String(err) });
    renderCache.delete(code);
  });

  return promise;
}
