import mermaid from 'mermaid';

let isInitialized = false;
let renderCount = 0;

function ensureMermaidInitialized() {
  if (isInitialized) return;

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'default',
  });

  isInitialized = true;
}

export async function renderMermaidToSvg(code: string): Promise<string> {
  ensureMermaidInitialized();

  renderCount += 1;
  const id = `vk-mermaid-${renderCount}`;
  const { svg } = await mermaid.render(id, code);
  return svg;
}
