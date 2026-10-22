import { useState } from 'react';
import TermsAndConditionsModal from '~/components/ui/TermsAndConditionsModal';
import ImportantNoticeModal from '~/components/ui/ImportantNoticeModal';
import { useLocalize } from '~/hooks';
import { TStartupConfig } from 'librechat-data-provider';

function Footer({ startupConfig }: { startupConfig: TStartupConfig | null | undefined }) {
  const localize = useLocalize();
  // Which legal dialog is open on the login page.
  const [openDialog, setOpenDialog] = useState<'privacy' | 'terms' | null>(null);
  if (!startupConfig) {
    return null;
  }
  const privacyPolicy = startupConfig.interface?.privacyPolicy;
  const termsOfService = startupConfig.interface?.termsOfService;

  const privacyPolicyRender = privacyPolicy?.externalUrl && (
    <button
      type="button"
      className="text-sm text-green-600 underline decoration-transparent transition-all duration-200 hover:text-green-700 hover:decoration-green-700 focus:text-green-700 focus:decoration-green-700 dark:text-green-500 dark:hover:text-green-400 dark:hover:decoration-green-400 dark:focus:text-green-400 dark:focus:decoration-green-400"
      onClick={() => setOpenDialog('privacy')}
    >
      {localize('com_ui_privacy_policy')}
    </button>
  );

  const termsOfServiceRender = termsOfService?.externalUrl && (
    <button
      type="button"
      className="text-sm text-green-600 underline decoration-transparent transition-all duration-200 hover:text-green-700 hover:decoration-green-700 focus:text-green-700 focus:decoration-green-700 dark:text-green-500 dark:hover:text-green-400 dark:hover:decoration-green-400 dark:focus:text-green-400 dark:focus:decoration-green-400"
      onClick={() => setOpenDialog('terms')}
    >
      {localize('com_ui_terms_of_service')}
    </button>
  );

  return (
    <div className="align-end m-4 flex justify-center gap-2" role="contentinfo">
      {privacyPolicyRender}
      {privacyPolicyRender && termsOfServiceRender && (
        <div className="border-r-[1px] border-gray-300 dark:border-gray-600" />
      )}
      {termsOfServiceRender}
      {/* Read-only dialogs, the same ones the account menu opens inside the app. */}
      {openDialog === 'terms' && (
        <TermsAndConditionsModal
          open
          onOpenChange={(isOpen) => !isOpen && setOpenDialog(null)}
          title={termsOfService?.modalTitle}
          modalContent={termsOfService?.modalContent}
          readOnly
        />
      )}
      {openDialog === 'privacy' && (
        <ImportantNoticeModal
          open
          onOpenChange={(isOpen) => !isOpen && setOpenDialog(null)}
          readOnly
        />
      )}
    </div>
  );
}

export default Footer;
