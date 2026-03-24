import React from 'react';
import { useLocalize } from '~/hooks';
import { Tools } from 'librechat-data-provider';
import { UIResourceRenderer } from '@mcp-ui/client';
import UIResourceCarousel from './UIResourceCarousel';
import type { TAttachment, UIResource } from 'librechat-data-provider';
import MarketChart from './MarketChart';

function OptimizedCodeBlock({ text, maxHeight = 320 }: { text: string; maxHeight?: number }) {
  return (
    <div
      className="rounded-lg bg-surface-tertiary p-2 text-xs text-text-primary"
      style={{
        position: 'relative',
        maxHeight,
        overflow: 'auto',
      }}
    >
      <pre className="m-0 whitespace-pre-wrap break-words" style={{ overflowWrap: 'break-word' }}>
        <code>{text}</code>
      </pre>
    </div>
  );
}

export default function ToolCallInfo({
  input,
  output,
  domain,
  function_name,
  pendingAuth,
  attachments,
}: {
  input: string;
  function_name: string;
  output?: string | null;
  domain?: string;
  pendingAuth?: boolean;
  attachments?: TAttachment[];
}) {
  const localize = useLocalize();
  const formatText = (text: string) => {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  };

  let title =
    domain != null && domain
      ? localize('com_assistants_domain_info', { 0: domain })
      : localize('com_assistants_function_use', { 0: function_name });
  if (pendingAuth === true) {
    title =
      domain != null && domain
        ? localize('com_assistants_action_attempt', { 0: domain })
        : localize('com_assistants_attempt_info');
  }

  const uiResources: UIResource[] =
    attachments
      ?.filter((attachment) => attachment.type === Tools.ui_resources)
      .flatMap((attachment) => {
        return attachment[Tools.ui_resources] as UIResource[];
      }) ?? [];

  return (
    <div className="w-full p-2">
      <div style={{ opacity: 1 }}>
        <div className="mb-2 text-sm font-medium text-text-primary">{title}</div>
        <div>
          {(() => {
            if (!output || output.toLowerCase().includes('error')) {
              // Demo Mode: If it's a market call but failed (e.g. no API key), show mock data for verification
              if (function_name.toLowerCase().includes('market')) {
                const mockData = [
                  { date: '2024-03-17', price: 2100 },
                  { date: '2024-03-18', price: 2150 },
                  { date: '2024-03-19', price: 2120 },
                  { date: '2024-03-20', price: 2180 },
                  { date: '2024-03-21', price: 2210 },
                  { date: '2024-03-22', price: 2200 },
                  { date: '2024-03-23', price: 2250 }
                ];
                return (
                  <div className="relative">
                    <div className="absolute top-2 right-2 z-10 bg-yellow-100 text-yellow-800 text-[10px] px-2 py-0.5 rounded font-bold border border-yellow-200 shadow-sm animate-pulse">
                      DEMO MODE
                    </div>
                    <MarketChart
                      data={mockData}
                      crop="Demo Wheat"
                      market="Mumbai Mandi"
                      unit="₹/Quintal"
                    />
                  </div>
                );
              }
              return <OptimizedCodeBlock text={formatText(input)} maxHeight={250} />;
            }
            try {
              const parsed = JSON.parse(output);
              if (parsed.market_data && Array.isArray(parsed.market_data)) {
                return (
                  <MarketChart
                    data={parsed.market_data}
                    crop={parsed.crop}
                    market={parsed.market}
                    unit={parsed.unit}
                  />
                );
              }
            } catch (e) {
              /* Not JSON or invalid format */
            }
            return <OptimizedCodeBlock text={formatText(input)} maxHeight={250} />;
          })()}
        </div>
        {output && (
          <>
            <div className="my-2 text-sm font-medium text-text-primary">
              {localize('com_ui_result')}
            </div>
            <div>
              {(() => {
                try {
                  const parsed = JSON.parse(output);
                  if (parsed.market_data && Array.isArray(parsed.market_data)) {
                    return null; // Don't show raw JSON if chart is rendered above
                  }
                } catch (e) { /* ignore */ }
                return <OptimizedCodeBlock text={formatText(output)} maxHeight={250} />;
              })()}
            </div>
            {uiResources.length > 0 && (
              <div className="my-2 text-sm font-medium text-text-primary">
                {localize('com_ui_ui_resources')}
              </div>
            )}
            <div>
              {uiResources.length > 1 && <UIResourceCarousel uiResources={uiResources} />}

              {uiResources.length === 1 && (
                <UIResourceRenderer
                  resource={uiResources[0]}
                  onUIAction={async (result) => {
                    console.log('Action:', result);
                  }}
                  htmlProps={{
                    autoResizeIframe: { width: true, height: true },
                  }}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
