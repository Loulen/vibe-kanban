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
  if (cached) return cached;

  renderCount += 1;
  const id = `vk-mermaid-${renderCount}`;

  // Use a detached container so mermaid never touches the visible DOM on error
  const container = document.createElement('div');

  const promise = mermaid
    .render(id, code, container)
    .then(({ svg }) => svg)
    .finally(() => {
      // Remove any orphaned elements Mermaid may have added to <body>
      const orphan = document.getElementById(id);
      orphan?.remove();
      // Also remove the temp container's content
      container.remove();
    });

  renderCache.set(code, promise);

  // On failure, remove from cache so a retry with different code can work
  promise.catch(() => {
    renderCache.delete(code);
  });

  return promise;
}
