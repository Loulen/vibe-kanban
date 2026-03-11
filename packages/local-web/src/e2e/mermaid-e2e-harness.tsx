import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider as NiceModalProvider } from '@ebay/nice-modal-react';
import WYSIWYGEditor from '@/shared/components/WYSIWYGEditor';
import '@/app/styles/new/index.css';

const validMermaidMarkdown = [
  'Valid Mermaid diagram:',
  '```mermaid',
  'flowchart LR',
  '  A[User Input] --> B[Backend]',
  '  B --> C[Database]',
  '  C --> B',
  '  B --> D[UI Response]',
  '```',
].join('\n');

const invalidMermaidMarkdown = [
  'Invalid Mermaid diagram:',
  '```mermaid',
  'graph LR',
  '  A-->',
  '```',
].join('\n');

const nonAssistantMarkdown = validMermaidMarkdown;

const maliciousMermaidMarkdown = [
  'Mermaid sanitizer check:',
  '```mermaid',
  'graph LR',
  '  A[Start] --> B[Done]',
  '  click A "javascript:alert(\'xss\')" "Bad Link"',
  '```',
].join('\n');

function MermaidHarness() {
  return (
    <NiceModalProvider>
      <main className="new-design min-h-screen bg-primary p-double font-ibm-plex-sans text-normal">
        <div className="mx-auto flex max-w-4xl flex-col gap-double">
          <section
            className="rounded border bg-panel p-base"
            data-testid="assistant-valid-mermaid"
          >
            <h1 className="mb-base text-lg text-high">
              Valid Mermaid (enabled)
            </h1>
            <WYSIWYGEditor
              disabled={true}
              value={validMermaidMarkdown}
              enableMermaid={true}
            />
          </section>

          <section
            className="rounded border bg-panel p-base"
            data-testid="assistant-invalid-mermaid"
          >
            <h1 className="mb-base text-lg text-high">
              Invalid Mermaid (enabled)
            </h1>
            <WYSIWYGEditor
              disabled={true}
              value={invalidMermaidMarkdown}
              enableMermaid={true}
            />
          </section>

          <section
            className="rounded border bg-panel p-base"
            data-testid="non-assistant-mermaid-disabled"
          >
            <h1 className="mb-base text-lg text-high">Mermaid disabled</h1>
            <WYSIWYGEditor
              disabled={true}
              value={nonAssistantMarkdown}
              enableMermaid={false}
            />
          </section>

          <section
            className="rounded border bg-panel p-base"
            data-testid="assistant-malicious-mermaid"
          >
            <h1 className="mb-base text-lg text-high">Mermaid sanitizer</h1>
            <WYSIWYGEditor
              disabled={true}
              value={maliciousMermaidMarkdown}
              enableMermaid={true}
            />
          </section>
        </div>
      </main>
    </NiceModalProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MermaidHarness />
  </React.StrictMode>
);
