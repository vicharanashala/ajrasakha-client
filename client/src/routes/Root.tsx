import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useMediaQuery } from '@librechat/client';
import type { ContextType } from '~/common';
import {
  useSearchEnabled,
  useAssistantsMap,
  useAuthContext,
  useAgentsMap,
  useFileMap,
  useWebPush,
} from '~/hooks';
import {
  PromptGroupsProvider,
  AssistantsMapContext,
  AgentsMapContext,
  SetConvoProvider,
  FileMapContext,
} from '~/Providers';
import {
  useUserTermsQuery,
  useGetStartupConfig,
  useHealthCheck,
  useUpdateFarmerPlatformMutation,
} from '~/data-provider';
import { Nav, MobileNav, NAV_WIDTH } from '~/components/Nav';
import { cn } from '~/utils';
import {
  TermsAndConditionsModal,
  ImportantNoticeModal,
  FarmerProfileModal,
  FarmerLocationModal,
} from '~/components/ui';

export default function Root() {
  const [showTerms, setShowTerms] = useState(false);
  const [showTestingNotice, setShowTestingNotice] = useState(false);
  const [showFarmerProfile, setShowFarmerProfile] = useState(false);
  const [showFarmerLocation, setShowFarmerLocation] = useState(false);
  const [navVisible, setNavVisible] = useState(() => {
    const savedNavVisible = localStorage.getItem('navVisible');
    return savedNavVisible !== null ? JSON.parse(savedNavVisible) : true;
  });

  const { isAuthenticated, logout } = useAuthContext();
  const isSmallScreen = useMediaQuery('(max-width: 768px)');

  // Global health check - runs once per authenticated session
  useHealthCheck(isAuthenticated);

  const assistantsMap = useAssistantsMap({ isAuthenticated });
  const agentsMap = useAgentsMap({ isAuthenticated });
  const fileMap = useFileMap({ isAuthenticated });

  const { data: config } = useGetStartupConfig();
  const { data: termsData } = useUserTermsQuery({
    enabled: isAuthenticated && config?.interface?.termsOfService?.modalAcceptance === true,
  });
  const updateFarmerPlatform = useUpdateFarmerPlatformMutation();

  useSearchEnabled(isAuthenticated);
  useWebPush();

  useEffect(() => {
    if (!termsData) {
      return;
    }
    if (!termsData.termsAccepted) {
      setShowTerms(true);
      return;
    }
    if (!termsData.secondTermsAccepted) {
      setShowTestingNotice(true);
      return;
    }
    if (!termsData.farmerProfileCompleted) {
      setShowFarmerProfile(true);
      return;
    }
    if (!termsData.farmerProfileHasPlatform) {
      const ua = navigator.userAgent;
      let platform = 'Unknown';
      if (/android/i.test(ua)) platform = 'Android';
      else if (/iphone|ipad|ipod/i.test(ua)) platform = 'iOS';
      else if (/windows/i.test(ua)) platform = 'Windows';
      else if (/macintosh|mac os x/i.test(ua)) platform = 'MacOS';
      else if (/linux/i.test(ua)) platform = 'Linux';
      updateFarmerPlatform.mutate(platform);
    }
    if (termsData.farmerNeedsUpdate) {
      setShowFarmerLocation(true);
    }
  }, [termsData]);

  const handleAcceptTerms = () => {
    setShowTerms(false);
  };

  const handleDeclineTerms = () => {
    setShowTerms(false);
    logout('/login?redirect=false');
  };

  // ImportantNoticeModal handles the DB write itself via useAcceptSecondTermsMutation.
  // This callback fires after the mutation succeeds.
  const handleAcceptTestingNotice = () => {
    setShowTestingNotice(false);
    if (!termsData?.farmerProfileCompleted) {
      setShowFarmerProfile(true);
    }
  };

  const handleDeclineTestingNotice = () => {
    setShowTestingNotice(false);
    logout('/login');
  };

  const handleFarmerProfileComplete = () => {
    setShowFarmerProfile(false);
  };

  const handleFarmerLocationComplete = () => {
    setShowFarmerLocation(false);
  };

  const handleDeclineFarmerProfile = () => {
    setShowFarmerProfile(false);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <SetConvoProvider>
      <FileMapContext.Provider value={fileMap}>
        <AssistantsMapContext.Provider value={assistantsMap}>
          <AgentsMapContext.Provider value={agentsMap}>
            <PromptGroupsProvider>
              <div className="flex h-dvh">
                <div className="relative z-0 flex h-full w-full overflow-hidden">
                  <Nav navVisible={navVisible} setNavVisible={setNavVisible} />
                  <div
                    className="relative isolate flex h-full max-w-full flex-1 flex-col overflow-hidden bg-presentation"
                    style={
                      isSmallScreen
                        ? {
                            transform: navVisible
                              ? `translateX(${NAV_WIDTH.MOBILE}px)`
                              : 'translateX(0)',
                            transition: 'transform 0.2s ease-out',
                          }
                        : undefined
                    }
                  >
                    {/* Soft brand-green glow washing down from the very top of the app
                        column, behind the mobile nav as well as the chat area. Decorative:
                        `-z-10` puts it under the content and `isolate` on this column keeps
                        that negative index from escaping behind the sidebar. Dark mode uses
                        the lighter brand green at a lower alpha, since the dark green on a
                        near-black page reads as a colour cast rather than light. */}
                    <div
                      aria-hidden="true"
                      className={cn(
                        'pointer-events-none absolute inset-x-0 top-0 -z-10 h-56 sm:h-72',
                        'bg-[radial-gradient(120%_100%_at_50%_0%,rgba(25,135,84,0.13),transparent_72%)]',
                        'dark:bg-[radial-gradient(120%_100%_at_50%_0%,rgba(117,215,178,0.09),transparent_72%)]',
                      )}
                    />
                    <MobileNav navVisible={navVisible} setNavVisible={setNavVisible} />
                    <Outlet context={{ navVisible, setNavVisible } satisfies ContextType} />
                  </div>
                </div>
              </div>
            </PromptGroupsProvider>
          </AgentsMapContext.Provider>
          {config?.interface?.termsOfService?.modalAcceptance === true && (
            <TermsAndConditionsModal
              open={showTerms}
              onOpenChange={setShowTerms}
              onAccept={handleAcceptTerms}
              onDecline={handleDeclineTerms}
              title={config.interface.termsOfService.modalTitle}
              modalContent={config.interface.termsOfService.modalContent}
            />
          )}
          <ImportantNoticeModal
            open={showTestingNotice}
            onOpenChange={setShowTestingNotice}
            onAccept={handleAcceptTestingNotice}
            onDecline={handleDeclineTestingNotice}
          />
          <FarmerProfileModal
            open={showFarmerProfile}
            onOpenChange={setShowFarmerProfile}
            onComplete={handleFarmerProfileComplete}
            onDecline={handleDeclineFarmerProfile}
          />
          <FarmerLocationModal
            open={showFarmerLocation}
            onOpenChange={setShowFarmerLocation}
            onComplete={handleFarmerLocationComplete}
            missingFields={termsData?.missingFields || []}
            initialData={termsData?.farmerProfile}
          />
        </AssistantsMapContext.Provider>
      </FileMapContext.Provider>
    </SetConvoProvider>
  );
}