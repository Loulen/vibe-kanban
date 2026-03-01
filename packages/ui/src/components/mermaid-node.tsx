import { useEffect, useState } from 'react';
import type { NodeKey, SerializedLexicalNode, Spread } from 'lexical';
import {
  createDecoratorNode,
  type DecoratorNodeConfig,
  type GeneratedDecoratorNode,
} from './create-decorator-node';
import { renderMermaidToSvg } from '../lib/mermaid';

export interface MermaidData {
  code: string;
}

export type SerializedMermaidNode = Spread<MermaidData, SerializedLexicalNode>;

export interface OpenMermaidPreviewOptions {
  code: string;
}

export interface CreateMermaidNodeOptions {
  openMermaidPreview: (options: OpenMermaidPreviewOptions) => void;
}

export function createMermaidNode(options: CreateMermaidNodeOptions) {
  const { openMermaidPreview } = options;

  function MermaidComponent({
    data,
    onDoubleClickEdit,
  }: {
    data: MermaidData;
    nodeKey: NodeKey;
    onDoubleClickEdit: (event: React.MouseEvent) => void;
  }): JSX.Element {
    const [svg, setSvg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      let isMounted = true;

      setSvg(null);
      setError(null);

      renderMermaidToSvg(data.code)
        .then((nextSvg) => {
          if (!isMounted) return;
          setSvg(nextSvg);
        })
        .catch(() => {
          if (!isMounted) return;
          setError('Unable to render Mermaid diagram');
        });

      return () => {
        isMounted = false;
      };
    }, [data.code]);

    const openPreview = (event: React.MouseEvent | React.KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      openMermaidPreview({ code: data.code });
    };

    return (
      <div className="my-2 w-full">
        <div
          className="group w-full overflow-auto rounded border border-border bg-primary p-3 cursor-zoom-in hover:border-muted-foreground transition-colors"
          role="button"
          tabIndex={0}
          aria-label="Open Mermaid diagram"
          onClick={openPreview}
          onDoubleClick={onDoubleClickEdit}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            openPreview(event);
          }}
        >
          {error && (
            <p className="text-xs text-error font-ibm-plex-mono">{error}</p>
          )}
          {!error && !svg && (
            <p className="text-xs text-muted-foreground font-ibm-plex-mono">
              Rendering Mermaid diagram...
            </p>
          )}
          {svg && (
            <div
              className="min-w-fit [&_svg]:h-auto [&_svg]:max-w-none [&_svg]:mx-auto"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          )}
        </div>
      </div>
    );
  }

  const config: DecoratorNodeConfig<MermaidData> = {
    type: 'mermaid-diagram',
    serialization: {
      format: 'fenced',
      language: 'mermaid',
      serialize: (data) => data.code,
      deserialize: (content) => ({ code: content.trim() }),
      validate: (data) => data.code.trim().length > 0,
    },
    component: MermaidComponent,
    domStyle: {
      display: 'block',
      width: '100%',
    },
    keyboardSelectable: false,
  };

  const result = createDecoratorNode(config);

  return {
    MermaidNode: result.Node,
    $createMermaidNode: (code: string) => result.createNode({ code }),
    $isMermaidNode: result.isNode,
    MERMAID_EXPORT_TRANSFORMER: result.transformers[0],
    MERMAID_TRANSFORMER: result.transformers[1],
  };
}

export type MermaidNodeInstance = GeneratedDecoratorNode<MermaidData>;
