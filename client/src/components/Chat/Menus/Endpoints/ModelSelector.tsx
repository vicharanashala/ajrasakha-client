import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { TooltipAnchor } from '@librechat/client';
import { getConfigDefaults } from 'librechat-data-provider';
import type { ModelSelectorProps } from '~/common';
import {
  renderModelSpecs,
  renderEndpoints,
  renderSearchResults,
  renderCustomGroups,
} from './components';
import { ModelSelectorProvider, useModelSelectorContext } from './ModelSelectorContext';
import { ModelSelectorChatProvider } from './ModelSelectorChatContext';
import { getSelectedIcon, getDisplayValue } from './utils';
import { CustomMenu as Menu } from './CustomMenu';
import DialogManager from './DialogManager';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

/** Never shrink the model name below this, so it stays legible on very narrow screens. */
const MODEL_NAME_MIN_FONT_SIZE = 11;

function ModelSelectorContent() {
  const localize = useLocalize();

  const {
    // LibreChat
    agentsMap,
    modelSpecs,
    mappedEndpoints,
    endpointsConfig,
    // State
    searchValue,
    searchResults,
    selectedValues,
    // Functions
    setSearchValue,
    setSelectedValues,
    // Dialog
    keyDialogOpen,
    onOpenChange,
    keyDialogEndpoint,
  } = useModelSelectorContext();

  const selectedIcon = useMemo(
    () =>
      getSelectedIcon({
        mappedEndpoints: mappedEndpoints ?? [],
        selectedValues,
        modelSpecs,
        endpointsConfig,
      }),
    [mappedEndpoints, selectedValues, modelSpecs, endpointsConfig],
  );
  const selectedDisplayValue = useMemo(
    () =>
      getDisplayValue({
        localize,
        agentsMap,
        modelSpecs,
        selectedValues,
        mappedEndpoints,
      }),
    [localize, agentsMap, modelSpecs, selectedValues, mappedEndpoints],
  );

  /**
   * Auto-shrinks the model-name text so the FULL name always fits on one line
   * within whatever space is actually available, instead of being truncated
   * or overflowing. Only shrinks (never grows past the CSS-defined size), and
   * only as much as needed for this particular name/viewport combination.
   */
  const modelNameRef = useRef<HTMLSpanElement>(null);
  const [modelNameOverflowing, setModelNameOverflowing] = useState(false);

  const fitModelName = useCallback(() => {
    const el = modelNameRef.current;
    if (!el) {
      return;
    }
    el.style.fontSize = '';
    const baseFontSize = parseFloat(window.getComputedStyle(el).fontSize) || 12;
    const { scrollWidth, clientWidth } = el;
    if (clientWidth > 0 && scrollWidth > clientWidth) {
      const ratio = (clientWidth / scrollWidth) * 0.97;
      const nextSize = Math.max(baseFontSize * ratio, MODEL_NAME_MIN_FONT_SIZE);
      el.style.fontSize = `${nextSize}px`;
      // Even at the minimum size it may still not fit; only then fall back to an ellipsis.
      setModelNameOverflowing(el.scrollWidth > el.clientWidth);
    } else {
      setModelNameOverflowing(false);
    }
  }, []);

  useLayoutEffect(() => {
    fitModelName();
  }, [selectedDisplayValue, fitModelName]);

  useLayoutEffect(() => {
    const el = modelNameRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => fitModelName());
    observer.observe(el);
    return () => observer.disconnect();
  }, [fitModelName]);

  const trigger = (
    <TooltipAnchor
      aria-label={localize('com_ui_select_model')}
      description={localize('com_ui_select_model')}
      render={
        <button
          className="model-selector-trigger group flex h-9 min-w-0 max-w-full items-center gap-1.5 rounded-full border border-transparent bg-transparent px-3 text-[13px] font-medium text-text-primary transition-colors duration-200 hover:bg-surface-secondary md:text-sm"
          aria-label={localize('com_ui_select_model')}
        >
          {selectedIcon && React.isValidElement(selectedIcon) && (
            <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center overflow-hidden">
              {selectedIcon}
            </div>
          )}
          <span
            ref={modelNameRef}
            className={cn(
              'min-w-0 flex-grow whitespace-nowrap text-left',
              modelNameOverflowing && 'overflow-hidden text-ellipsis',
            )}
          >
            {selectedDisplayValue}
          </span>
          <ChevronDown
            className="h-3.5 w-3.5 flex-shrink-0 text-text-secondary transition-colors duration-200 group-hover:text-text-primary"
            aria-hidden="true"
          />
        </button>
      }
    />
  );

  return (
    <div className="relative flex w-fit flex-col items-center">
      <Menu
        values={selectedValues}
        onValuesChange={(values: Record<string, any>) => {
          setSelectedValues({
            endpoint: values.endpoint || '',
            model: values.model || '',
            modelSpec: values.modelSpec || '',
          });
        }}
        onSearch={(value) => setSearchValue(value)}
        combobox={<input id="model-search" placeholder=" " />}
        comboboxLabel={localize('com_endpoint_search_models')}
        trigger={trigger}
      >
        {searchResults ? (
          renderSearchResults(searchResults, localize, searchValue)
        ) : (
          <>
            {/* Render ungrouped modelSpecs (no group field) */}
            {renderModelSpecs(
              modelSpecs?.filter((spec) => !spec.group) || [],
              selectedValues.modelSpec || '',
            )}
            {/* Render endpoints (will include grouped specs matching endpoint names) */}
            {renderEndpoints(mappedEndpoints ?? [])}
            {/* Render custom groups (specs with group field not matching any endpoint) */}
            {renderCustomGroups(modelSpecs || [], mappedEndpoints ?? [])}
          </>
        )}
      </Menu>
      <DialogManager
        keyDialogOpen={keyDialogOpen}
        onOpenChange={onOpenChange}
        endpointsConfig={endpointsConfig || {}}
        keyDialogEndpoint={keyDialogEndpoint || undefined}
      />
    </div>
  );
}

export default function ModelSelector({ startupConfig }: ModelSelectorProps) {
  const interfaceConfig = startupConfig?.interface ?? getConfigDefaults().interface;
  const modelSpecs = startupConfig?.modelSpecs?.list ?? [];

  // Hide the selector when modelSelect is false and there are no model specs to show
  if (interfaceConfig.modelSelect === false && modelSpecs.length === 0) {
    return null;
  }

  return (
    <ModelSelectorChatProvider>
      <ModelSelectorProvider startupConfig={startupConfig}>
        <ModelSelectorContent />
      </ModelSelectorProvider>
    </ModelSelectorChatProvider>
  );
}
