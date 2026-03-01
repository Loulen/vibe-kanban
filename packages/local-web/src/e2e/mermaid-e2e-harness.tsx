import React from 'react';
import ReactDOM from 'react-dom/client';
import WYSIWYGEditor from '@/shared/components/WYSIWYGEditor';
import { AssistantMessageEntry } from '@/features/workspace-chat/ui/NewDisplayConversationEntry';
import '@/app/styles/new/index.css';

const validAssistantMarkdown = [
  'Assistant valid Mermaid diagram:',
  '```mermaid',
  'graph LR',
  '  A[Start] --> B[Done]',
  '```',
].join('\n');

const invalidAssistantMarkdown = [
  'Assistant invalid Mermaid diagram:',
  '```mermaid',
  'graph LR',
  '  A-->',
  '```',
].join('\n');

const nonAssistantMarkdown = validAssistantMarkdown;

const maliciousAssistantMarkdown = [
  'Assistant Mermaid sanitizer check:',
  '```mermaid',
  'graph LR',
  '  A[Start] --> B[Done]',
  '  click A "javascript:alert(\'xss\')" "Bad Link"',
  '```',
].join('\n');

function MermaidHarness() {
  return (
    <main className="new-design min-h-screen bg-primary p-double font-ibm-plex-sans text-normal">
      <div className="mx-auto flex max-w-4xl flex-col gap-double">
        <section
          className="rounded border bg-panel p-base"
          data-testid="assistant-valid-mermaid"
        >
          <h1 className="mb-base text-lg text-high">Assistant valid Mermaid</h1>
          <AssistantMessageEntry
            content={validAssistantMarkdown}
            workspaceId={undefined}
          />
        </section>

        <section
          className="rounded border bg-panel p-base"
          data-testid="assistant-invalid-mermaid"
        >
          <h1 className="mb-base text-lg text-high">
            Assistant invalid Mermaid
          </h1>
          <AssistantMessageEntry
            content={invalidAssistantMarkdown}
            workspaceId={undefined}
          />
        </section>

        <section
          className="rounded border bg-panel p-base"
          data-testid="non-assistant-mermaid-disabled"
        >
          <h1 className="mb-base text-lg text-high">
            Non-assistant Mermaid disabled
          </h1>
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
          <h1 className="mb-base text-lg text-high">
            Assistant Mermaid sanitizer
          </h1>
          <AssistantMessageEntry
            content={maliciousAssistantMarkdown}
            workspaceId={undefined}
          />
        </section>
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MermaidHarness />
  </React.StrictMode>
);
