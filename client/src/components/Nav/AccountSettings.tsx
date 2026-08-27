import { useState, memo, useRef } from 'react';
import * as Select from '@ariakit/react/select';
import { FileText, LogOut, ScrollText, ShieldCheck } from 'lucide-react';
import { LinkIcon, GearIcon, DropdownMenuSeparator, Avatar, TooltipAnchor } from '@librechat/client';
import { MyFilesModal } from '~/components/Chat/Input/Files/MyFilesModal';
import TermsAndConditionsModal from '~/components/ui/TermsAndConditionsModal';
import ImportantNoticeModal from '~/components/ui/ImportantNoticeModal';
import LogoutConfirmModal from '~/components/ui/LogoutConfirmModal';
import { useGetStartupConfig, useGetUserBalance } from '~/data-provider';
import { useAuthContext } from '~/hooks/AuthContext';
import { useLocalize } from '~/hooks';
import Settings from './Settings';

const USER_ROLE_LABELS: Record<string, string> = {
  FARMER: 'Farmer',
  INTERNAL: 'Internal',
  DISTRICT_COORDINATOR: 'District Coordinator',
  BLOCK_COORDINATOR: 'Block Coordinator',
  VILLAGE_VOLUNTEER: 'Village Volunteer',
};

const formatUserRole = (userRole?: string | null): string | undefined => {
  if (userRole == null || userRole === '') {
    return undefined;
  }
  return (
    USER_ROLE_LABELS[userRole] ??
    userRole
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  );
};

function AccountSettings({ collapsed = false }: { collapsed?: boolean }) {
  const localize = useLocalize();
  const { user, isAuthenticated, logout } = useAuthContext();
  const roleLabel = formatUserRole(user?.userRole);
  const { data: startupConfig } = useGetStartupConfig();
  const balanceQuery = useGetUserBalance({
    enabled: !!isAuthenticated && startupConfig?.balance?.enabled,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const accountSettingsButtonRef = useRef<HTMLButtonElement>(null);

  const selectTrigger = (
    <Select.Select
      ref={accountSettingsButtonRef}
      aria-label={localize('com_nav_account_settings')}
      data-testid="nav-user"
      className={
        collapsed
          ? 'flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl p-0 transition-all duration-200 ease-in-out aria-[expanded=true]:bg-surface-active-alt'
          : 'mt-text-sm flex h-auto w-full cursor-pointer items-center gap-2 rounded-xl p-2 text-sm transition-all duration-200 ease-in-out aria-[expanded=true]:bg-surface-active-alt'
      }
    >
      <div className={collapsed ? 'h-8 w-8 flex-shrink-0' : '-ml-0.9 -mt-0.8 h-8 w-8 flex-shrink-0'}>
        <div className="relative flex">
          <Avatar user={user} size={32} />
        </div>
      </div>
      {!collapsed && (
        <div
          className="mt-2 grow overflow-hidden text-left"
          style={{ marginTop: '0', marginLeft: '0' }}
        >
          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-text-primary">
            {user?.name ?? user?.username ?? localize('com_nav_user')}
          </div>
          {roleLabel != null && (
            <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-secondary">
              {roleLabel}
            </div>
          )}
        </div>
      )}
    </Select.Select>
  );

  return (
    <Select.SelectProvider>
      {collapsed ? (
        <TooltipAnchor
          description={
            roleLabel != null
              ? `${user?.name ?? user?.username ?? localize('com_nav_account_settings')} — ${roleLabel}`
              : (user?.name ?? user?.username ?? localize('com_nav_account_settings'))
          }
          side="right"
          render={selectTrigger}
        />
      ) : (
        selectTrigger
      )}
      <Select.SelectPopover
        // Portal to document.body so the popover isn't clipped by the
        // sidebar's `overflow-hidden` wrapper — most visible when the
        // sidebar is collapsed to its narrow icon rail.
        portal
        gutter={8}
        overflowPadding={12}
        className="popover-ui account-settings-popover rounded-lg"
        style={{
          transformOrigin: 'bottom',
          translate: '0 -4px',
        }}
      >
        <div className="text-token-text-secondary ml-3 mr-2 py-2 text-sm" role="note">
          {user?.email ?? localize('com_nav_user')}
        </div>
        <DropdownMenuSeparator />
        {startupConfig?.balance?.enabled === true && balanceQuery.data != null && (
          <>
            <div className="text-token-text-secondary ml-3 mr-2 py-2 text-sm" role="note">
              {localize('com_nav_balance')}:{' '}
              {new Intl.NumberFormat().format(Math.round(balanceQuery.data.tokenCredits))}
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <Select.SelectItem
          value=""
          onClick={() => setShowFiles(true)}
          className="select-item text-sm"
        >
          <FileText className="icon-md" aria-hidden="true" />
          {localize('com_nav_my_files')}
        </Select.SelectItem>
        {startupConfig?.helpAndFaqURL !== '/' && (
          <Select.SelectItem
            value=""
            onClick={() => window.open(startupConfig?.helpAndFaqURL, '_blank')}
            className="select-item text-sm"
          >
            <LinkIcon aria-hidden="true" />
            {localize('com_nav_help_faq')}
          </Select.SelectItem>
        )}
        <Select.SelectItem
          value=""
          onClick={() => setShowTerms(true)}
          className="select-item text-sm"
        >
          <ScrollText className="icon-md" aria-hidden="true" />
          {localize('com_ui_terms_of_service')}
        </Select.SelectItem>
        <Select.SelectItem
          value=""
          onClick={() => setShowPrivacyPolicy(true)}
          className="select-item text-sm"
        >
          <ShieldCheck className="icon-md" aria-hidden="true" />
          {localize('com_ui_privacy_policy')}
        </Select.SelectItem>
        <Select.SelectItem
          value=""
          onClick={() => setShowSettings(true)}
          className="select-item text-sm"
        >
          <GearIcon className="icon-md" aria-hidden="true" />
          {localize('com_nav_settings')}
        </Select.SelectItem>
        <DropdownMenuSeparator />
        <Select.SelectItem
          aria-selected={true}
          onClick={() => setShowLogoutConfirm(true)}
          value="logout"
          className="select-item text-sm"
        >
          <LogOut className="icon-md" aria-hidden="true" />
          {localize('com_nav_log_out')}
        </Select.SelectItem>
      </Select.SelectPopover>
      {showFiles && (
        <MyFilesModal
          open={showFiles}
          onOpenChange={setShowFiles}
          triggerRef={accountSettingsButtonRef}
        />
      )}
      {showSettings && <Settings open={showSettings} onOpenChange={setShowSettings} />}
      {/* Same dialogs the user accepts during onboarding, opened here purely for review. */}
      {showTerms && (
        <TermsAndConditionsModal
          open={showTerms}
          onOpenChange={setShowTerms}
          title={startupConfig?.interface?.termsOfService?.modalTitle}
          modalContent={startupConfig?.interface?.termsOfService?.modalContent}
          readOnly
        />
      )}
      {showPrivacyPolicy && (
        <ImportantNoticeModal
          open={showPrivacyPolicy}
          onOpenChange={setShowPrivacyPolicy}
          readOnly
        />
      )}
      <LogoutConfirmModal
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        onConfirm={() => logout()}
      />
    </Select.SelectProvider>
  );
}

export default memo(AccountSettings);
