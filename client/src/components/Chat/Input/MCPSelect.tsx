import React, { memo, useMemo, useCallback, useRef } from 'react';
import * as Ariakit from '@ariakit/react';
import { ChevronDown } from 'lucide-react';
import { PermissionTypes, Permissions } from 'librechat-data-provider';
import { TooltipAnchor } from '@librechat/client';
import MCPServerMenuItem from '~/components/MCP/MCPServerMenuItem';
import MCPConfigDialog from '~/components/MCP/MCPConfigDialog';
import StackedMCPIcons from '~/components/MCP/StackedMCPIcons';
import { useBadgeRowContext } from '~/Providers';
import { useHasAccess } from '~/hooks';
import { cn } from '~/utils';

// function MCPSelectContent() {
//   const { conversationId, mcpServerManager } = useBadgeRowContext();
//   const {
//     localize,
//     isPinned,
//     mcpValues,
//     placeholderText,
//     selectableServers,
//     connectionStatus,
//     isInitializing,
//     getConfigDialogProps,
//     toggleServerSelection,
//     getServerStatusIconProps,
//   } = mcpServerManager;

const MOCK_MCP_SERVERS = [
  { serverName: 'reviewer', config: { title: 'Reviewer' }, effectivePermissions: 1 },
  { serverName: 'golden', config: { title: 'Golden' }, effectivePermissions: 1 },
  { serverName: 'weather', config: { title: 'Weather' }, effectivePermissions: 1 },
  { serverName: 'market', config: { title: 'Market' }, effectivePermissions: 1 },
  { serverName: 'pop', config: { title: 'Pop' }, effectivePermissions: 1 },
  { serverName: 'faq-videos', config: { title: 'FAQ Videos' }, effectivePermissions: 1 },
  { serverName: 'golden-n', config: { title: 'Golden-N' }, effectivePermissions: 1 },
];

function MCPSelectContent() {
  const { conversationId, mcpServerManager } = useBadgeRowContext();
  const {
    localize,
    isPinned,
    mcpValues,
    placeholderText,
    connectionStatus,
    isInitializing,
    getConfigDialogProps,
    toggleServerSelection,
    getServerStatusIconProps,
  } = mcpServerManager;

  const useMockMCP = import.meta.env.VITE_USE_MOCK_MCP === 'true';
  const realServers = mcpServerManager.selectableServers;
  const selectableServers = (useMockMCP || !realServers || realServers.length === 0)
    ? MOCK_MCP_SERVERS as typeof realServers
    : realServers;

  const menuStore = Ariakit.useMenuStore({ focusLoop: true });
  const isOpen = menuStore.useState('open');
  const focusedElementRef = useRef<HTMLElement | null>(null);

  const selectedCount = mcpValues?.length ?? 0;

  const handleToggle = useCallback(
    (serverName: string) => {
      focusedElementRef.current = document.activeElement as HTMLElement;
      const current = mcpValues ?? [];
      const updated = current.includes(serverName)
        ? current.filter((n) => n !== serverName)
        : [...current, serverName];
      mcpServerManager.setMCPValues(updated);
      requestAnimationFrame(() => {
        focusedElementRef.current?.focus();
      });
    },
    [mcpValues, mcpServerManager],
  );

  const selectedServers = useMemo(() => {
    if (!mcpValues || mcpValues.length === 0) {
      return [];
    }
    return selectableServers.filter((s) => mcpValues.includes(s.serverName));
  }, [selectableServers, mcpValues]);

  const displayText = useMemo(() => {
    if (selectedCount === 0) {
      return null;
    }
    if (selectedCount === 1) {
      const server = selectableServers.find((s) => s.serverName === mcpValues?.[0]);
      return server?.config?.title || mcpValues?.[0];
    }
    return localize('com_ui_x_selected', { 0: selectedCount });
  }, [selectedCount, selectableServers, mcpValues, localize]);

  // if (!isPinned && mcpValues?.length === 0) {
  //   return null;
  // }

  const configDialogProps = getConfigDialogProps();

  return (
    <>
      <Ariakit.MenuProvider store={menuStore}>
        <TooltipAnchor
          description={placeholderText}
          disabled={isOpen}
          render={
            <Ariakit.MenuButton
              className={cn(
                'group relative inline-flex items-center justify-center gap-1.5',
                'border border-border-medium text-sm font-medium transition-all',
                'h-9 min-w-9 rounded-full bg-transparent px-2.5 shadow-sm',
                'hover:bg-surface-hover hover:shadow-md active:shadow-inner',
                'md:w-fit md:justify-start md:px-3',
                isOpen && 'bg-surface-hover',
              )}
            />
          }
        >
          <StackedMCPIcons selectedServers={selectedServers} maxIcons={3} iconSize="sm" />
          <span className="hidden truncate text-text-primary md:block">
            {displayText || placeholderText}
          </span>
          <ChevronDown
            className={cn(
              'hidden h-3 w-3 text-text-secondary transition-transform md:block',
              isOpen && 'rotate-180',
            )}
          />
        </TooltipAnchor>

        <Ariakit.Menu
          portal={true}
          gutter={8}
          aria-label={localize('com_ui_mcp_servers')}
          className={cn(
            'z-50 flex min-w-[260px] max-w-[320px] flex-col rounded-xl',
            'border border-border-light bg-presentation p-1.5 shadow-lg',
            'origin-top opacity-0 transition-[opacity,transform] duration-200 ease-out',
            'data-[enter]:scale-100 data-[enter]:opacity-100',
            'scale-95 data-[leave]:scale-95 data-[leave]:opacity-0',
          )}
        >
          <div className="flex max-h-[320px] flex-col gap-1 overflow-y-auto">
            {selectableServers.map((server) => (
              <MCPServerMenuItem
                key={server.serverName}
                server={server}
                isSelected={mcpValues?.includes(server.serverName) ?? false}
                connectionStatus={connectionStatus}
                isInitializing={isInitializing}
                statusIconProps={getServerStatusIconProps(server.serverName)}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </Ariakit.Menu>
      </Ariakit.MenuProvider>
      {configDialogProps && (
        <MCPConfigDialog {...configDialogProps} conversationId={conversationId} />
      )}
    </>
  );
}

// NOTE (sonu intern): Original function commented out — no MCP server access given to user yet.
// Once access is provided, remove mock data below and uncomment canUseMcp check.
//
// Original:
// function MCPSelect() {
//   const { mcpServerManager } = useBadgeRowContext();
//   const { selectableServers } = mcpServerManager;
//   const canUseMcp = useHasAccess({
//     permissionType: PermissionTypes.MCP_SERVERS,
//     permission: Permissions.USE,
//   });
//   if (!canUseMcp || !selectableServers || selectableServers.length === 0) {
//     return null;
//   }
//   return <MCPSelectContent />;
// }

function MCPSelect() {
  const { mcpServerManager } = useBadgeRowContext();
  const { selectableServers: realServers } = mcpServerManager;

  const useMockMCP = import.meta.env.VITE_USE_MOCK_MCP === 'true';

  const mockServers = [
    { serverName: 'reviewer', config: { title: 'Reviewer' }, effectivePermissions: 1 },
    { serverName: 'golden', config: { title: 'Golden' }, effectivePermissions: 1 },
    { serverName: 'weather', config: { title: 'Weather' }, effectivePermissions: 1 },
    { serverName: 'market', config: { title: 'Market' }, effectivePermissions: 1 },
    { serverName: 'pop', config: { title: 'Pop' }, effectivePermissions: 1 },
    { serverName: 'faq-videos', config: { title: 'FAQ Videos' }, effectivePermissions: 1 },
    { serverName: 'golden-n', config: { title: 'Golden-N' }, effectivePermissions: 1 },
  ] as typeof realServers;

  // Local pe mock, production pe real
  const selectableServers = useMockMCP
    ? mockServers
    : (realServers && realServers.length > 0 ? realServers : mockServers);

  if (!selectableServers || selectableServers.length === 0) {
    return null;
  }

  return <MCPSelectContent />;
}

export default memo(MCPSelect);




// import React, { memo, useMemo, useCallback, useRef } from 'react';
// import * as Ariakit from '@ariakit/react';
// import { ChevronDown } from 'lucide-react';
// import { PermissionTypes, Permissions } from 'librechat-data-provider';
// import { TooltipAnchor } from '@librechat/client';
// import MCPServerMenuItem from '~/components/MCP/MCPServerMenuItem';
// import MCPConfigDialog from '~/components/MCP/MCPConfigDialog';
// import StackedMCPIcons from '~/components/MCP/StackedMCPIcons';
// import { useBadgeRowContext } from '~/Providers';
// import { useHasAccess } from '~/hooks';
// import { cn } from '~/utils';

// function MCPSelectContent() {
//   const { conversationId, mcpServerManager } = useBadgeRowContext();
//   const {
//     localize,
//     isPinned,
//     mcpValues,
//     placeholderText,
//     selectableServers,
//     connectionStatus,
//     isInitializing,
//     getConfigDialogProps,
//     toggleServerSelection,
//     getServerStatusIconProps,
//   } = mcpServerManager;

//   const menuStore = Ariakit.useMenuStore({ focusLoop: true });
//   const isOpen = menuStore.useState('open');
//   const focusedElementRef = useRef<HTMLElement | null>(null);

//   const selectedCount = mcpValues?.length ?? 0;

//   // Wrap toggleServerSelection to preserve focus after state update
//   const handleToggle = useCallback(
//     (serverName: string) => {
//       // Save currently focused element
//       focusedElementRef.current = document.activeElement as HTMLElement;
//       toggleServerSelection(serverName);
//       // Restore focus after React re-renders
//       requestAnimationFrame(() => {
//         focusedElementRef.current?.focus();
//       });
//     },
//     [toggleServerSelection],
//   );

//   const selectedServers = useMemo(() => {
//     if (!mcpValues || mcpValues.length === 0) {
//       return [];
//     }
//     return selectableServers.filter((s) => mcpValues.includes(s.serverName));
//   }, [selectableServers, mcpValues]);

//   const displayText = useMemo(() => {
//     if (selectedCount === 0) {
//       return null;
//     }
//     if (selectedCount === 1) {
//       const server = selectableServers.find((s) => s.serverName === mcpValues?.[0]);
//       return server?.config?.title || mcpValues?.[0];
//     }
//     return localize('com_ui_x_selected', { 0: selectedCount });
//   }, [selectedCount, selectableServers, mcpValues, localize]);

//   if (!isPinned && mcpValues?.length === 0) {
//     return null;
//   }

//   const configDialogProps = getConfigDialogProps();

//   return (
//     <>
//       <Ariakit.MenuProvider store={menuStore}>
//         <TooltipAnchor
//           description={placeholderText}
//           disabled={isOpen}
//           render={
//             <Ariakit.MenuButton
//               className={cn(
//                 'group relative inline-flex items-center justify-center gap-1.5',
//                 'border border-border-medium text-sm font-medium transition-all',
//                 'h-9 min-w-9 rounded-full bg-transparent px-2.5 shadow-sm',
//                 'hover:bg-surface-hover hover:shadow-md active:shadow-inner',
//                 'md:w-fit md:justify-start md:px-3',
//                 isOpen && 'bg-surface-hover',
//               )}
//             />
//           }
//         >
//           <StackedMCPIcons selectedServers={selectedServers} maxIcons={3} iconSize="sm" />
//           <span className="hidden truncate text-text-primary md:block">
//             {displayText || placeholderText}
//           </span>
//           <ChevronDown
//             className={cn(
//               'hidden h-3 w-3 text-text-secondary transition-transform md:block',
//               isOpen && 'rotate-180',
//             )}
//           />
//         </TooltipAnchor>

//         <Ariakit.Menu
//           portal={true}
//           gutter={8}
//           aria-label={localize('com_ui_mcp_servers')}
//           className={cn(
//             'z-50 flex min-w-[260px] max-w-[320px] flex-col rounded-xl',
//             'border border-border-light bg-presentation p-1.5 shadow-lg',
//             'origin-top opacity-0 transition-[opacity,transform] duration-200 ease-out',
//             'data-[enter]:scale-100 data-[enter]:opacity-100',
//             'scale-95 data-[leave]:scale-95 data-[leave]:opacity-0',
//           )}
//         >
//           <div className="flex max-h-[320px] flex-col gap-1 overflow-y-auto">
//             {selectableServers.map((server) => (
//               <MCPServerMenuItem
//                 key={server.serverName}
//                 server={server}
//                 isSelected={mcpValues?.includes(server.serverName) ?? false}
//                 connectionStatus={connectionStatus}
//                 isInitializing={isInitializing}
//                 statusIconProps={getServerStatusIconProps(server.serverName)}
//                 onToggle={handleToggle}
//               />
//             ))}
//           </div>
//         </Ariakit.Menu>
//       </Ariakit.MenuProvider>
//       {configDialogProps && (
//         <MCPConfigDialog {...configDialogProps} conversationId={conversationId} />
//       )}
//     </>
//   );
// }

// function MCPSelect() {
//   const { mcpServerManager } = useBadgeRowContext();
//   const { selectableServers } = mcpServerManager;
//   const canUseMcp = useHasAccess({
//     permissionType: PermissionTypes.MCP_SERVERS,
//     permission: Permissions.USE,
//   });

//   if (!canUseMcp || !selectableServers || selectableServers.length === 0) {
//     return null;
//   }

//   return <MCPSelectContent />;
// }

// export default memo(MCPSelect);
