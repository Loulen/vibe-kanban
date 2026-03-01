import { useEffect, useId, useMemo, useState } from 'react';
import { NodeKey, SerializedLexicalNode, Spread } from 'lexical';
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';
import {
  createDecoratorNode,
  type DecoratorNodeConfig,
  type GeneratedDecoratorNode,
} from './create-decorator-node';

export interface MermaidData {
  code: string;
}

export type SerializedMermaidNode = Spread<MermaidData, SerializedLexicalNode>;

type MermaidRenderState =
  | { status: 'rendering'; svg: null; error: null }
  | { status: 'success'; svg: string; error: null }
  | { status: 'error'; svg: null; error: string };

let isMermaidInitialized = false;

const MAX_MERMAID_CHARS = 20_000;
const MAX_MERMAID_LINES = 400;

function sanitizeMermaidSvg(svg: string): string | null {
  if (typeof DOMParser === 'undefined') {
    return null;
  }

  const sanitized = DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'object', 'embed'],
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel):|#|\/|\.\/|\.\.\/|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  });

  if (typeof sanitized !== 'string' || sanitized.trim().length === 0) {
    return null;
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(sanitized, 'image/svg+xml');

  if (document.querySelector('parsererror') || !document.documentElement) {
    return null;
  }

  if (document.documentElement.tagName.toLowerCase() !== 'svg') {
    return null;
  }

  return document.documentElement.outerHTML;
}

function ensureMermaidInitialized(): void {
  if (isMermaidInitialized) {
    return;
  }

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
  });

  isMermaidInitialized = true;
}

function MermaidRenderer({
  data,
  onDoubleClickEdit,
}: {
  data: MermaidData;
  nodeKey: NodeKey;
  onDoubleClickEdit: (event: React.MouseEvent) => void;
}): JSX.Element {
  const [renderState, setRenderState] = useState<MermaidRenderState>({
    status: 'rendering',
    svg: null,
    error: null,
  });

  const trimmedCode = useMemo(() => data.code.trim(), [data.code]);
  const reactId = useId();
  const renderId = useMemo(
    () => `mermaid-inline-${reactId.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
    [reactId],
  );

  useEffect(() => {
    if (trimmedCode.length === 0) {
      setRenderState({
        status: 'error',
        svg: null,
        error: 'Mermaid diagram is empty.',
      });
      return;
    }

    if (trimmedCode.length > MAX_MERMAID_CHARS) {
      setRenderState({
        status: 'error',
        svg: null,
        error: `Mermaid diagram is too large (max ${MAX_MERMAID_CHARS} characters).`,
      });
      return;
    }

    const lineCount = trimmedCode.split(/\r?\n/).length;
    if (lineCount > MAX_MERMAID_LINES) {
      setRenderState({
        status: 'error',
        svg: null,
        error: `Mermaid diagram has too many lines (max ${MAX_MERMAID_LINES}).`,
      });
      return;
    }

    let isCancelled = false;

    setRenderState({ status: 'rendering', svg: null, error: null });

    ensureMermaidInitialized();

    void mermaid
      .render(renderId, trimmedCode)
      .then(({ svg }) => {
        if (isCancelled) {
          return;
        }

        const sanitizedSvg = sanitizeMermaidSvg(svg);

        if (!sanitizedSvg) {
          setRenderState({
            status: 'error',
            svg: null,
            error: 'Mermaid rendered invalid SVG output.',
          });
          return;
        }

        setRenderState({ status: 'success', svg: sanitizedSvg, error: null });
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        const message =
          error instanceof Error ? error.message : 'Failed to render Mermaid.';
        setRenderState({ status: 'error', svg: null, error: message });
      });

    return () => {
      isCancelled = true;
    };
  }, [renderId, trimmedCode]);

  if (renderState.status === 'error') {
    return (
      <span
        className="inline-flex w-full flex-col gap-half rounded-sm border border-destructive/50 bg-destructive/5 px-base py-base"
        onDoubleClick={onDoubleClickEdit}
      >
        <span className="text-xs text-destructive">
          Unable to render Mermaid diagram.
        </span>
        <span className="text-xs text-destructive/80">{renderState.error}</span>
        <pre className="overflow-x-auto rounded-sm bg-muted px-half py-half text-xs text-foreground">
          <code>{data.code}</code>
        </pre>
      </span>
    );
  }

  if (renderState.status === 'rendering') {
    return (
      <span
        className="inline-flex w-full rounded-sm border border-border bg-muted/40 px-base py-base text-xs text-muted-foreground"
        onDoubleClick={onDoubleClickEdit}
      >
        Rendering Mermaid diagram...
      </span>
    );
  }

  return (
    <span
      className="inline-flex w-full overflow-x-auto rounded-sm border border-border bg-background px-base py-base"
      onDoubleClick={onDoubleClickEdit}
      dangerouslySetInnerHTML={{ __html: renderState.svg }}
    />
  );
}

const config: DecoratorNodeConfig<MermaidData> = {
  type: 'mermaid',
  serialization: {
    format: 'fenced',
    language: 'mermaid',
    serialize: (data) => data.code,
    deserialize: (content) => ({ code: content }),
    validate: (data) => data.code.trim().length > 0,
  },
  component: MermaidRenderer,
  domStyle: {
    display: 'block',
  },
  keyboardSelectable: false,
  exportDOM: (data) => {
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.setAttribute('class', 'language-mermaid');
    code.textContent = data.code;
    pre.appendChild(code);
    return pre;
  },
};

const result = createDecoratorNode(config);

export const MermaidNode = result.Node;
export type MermaidNodeInstance = GeneratedDecoratorNode<MermaidData>;
export const $createMermaidNode = result.createNode;
export const $isMermaidNode = result.isNode;
export const [MERMAID_EXPORT_TRANSFORMER, MERMAID_TRANSFORMER] =
  result.transformers;
