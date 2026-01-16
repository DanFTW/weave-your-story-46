import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Mail, Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEmailAutomation } from "@/hooks/useEmailAutomation";
import { useComposio } from "@/hooks/useComposio";
import { ContactSearch } from "../email-dump/ContactSearch";
import { ContactPreferences } from "./ContactPreferences";
import { ActiveMonitoring } from "./ActiveMonitoring";
import { ActivatingScreen } from "./ActivatingScreen";
import { Button } from "@/components/ui/button";

const gradientClasses: Record<string, string> = {
  blue: "thread-gradient-blue",
  teal: "thread-gradient-teal",
  purple: "thread-gradient-purple",
  orange: "thread-gradient-orange",
  pink: "thread-gradient-pink",
};

export function EmailAutomationFlow() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const gmail = useComposio('GMAIL');
  
  const {
    phase,
    setPhase,
    selectedContacts,
    monitoredContacts,
    searchResults,
    isSearching,
    isActivating,
    isLoading,
    isCheckingStatus,
    triggerStatuses,
    searchContacts,
    selectContact,
    deselectContact,
    updatePreferences,
    clearSelection,
    activateMonitoring,
    deactivateContact,
    loadMonitoredContacts,
    checkTriggerStatus,
    enableTrigger,
    reset,
  } = useEmailAutomation();

  // Legacy OAuth callback handling removed - now using database polling in useComposio hook

  // Check Gmail connection status and load existing contacts
  useEffect(() => {
    const checkAuth = async () => {
      await gmail.checkStatus();
      setIsCheckingAuth(false);
    };
    
    const connected = searchParams.get('connected');
    if (!connected) {
      checkAuth();
    }
  }, []);

  // Handle connection status changes
  useEffect(() => {
    if (isCheckingAuth) return;
    
    if (gmail.isConnected) {
      // Load existing monitored contacts
      loadMonitoredContacts().then(() => {
        if (phase === 'auth-check') {
          // Will be set to 'active' by loadMonitoredContacts if contacts exist
          // Otherwise stay at contact-search
          setPhase('contact-search');
        }
      });
    } else {
      // User is not connected, redirect to Gmail integration
      navigate('/integration/gmail');
    }
  }, [gmail.isConnected, isCheckingAuth, phase]);

  const handleBack = () => {
    switch (phase) {
      case 'auth-check':
      case 'contact-search':
        navigate('/threads');
        break;
      case 'preferences':
        setPhase('contact-search');
        break;
      case 'active':
        navigate('/threads');
        break;
      default:
        navigate('/threads');
    }
  };

  const handleContactSelect = (email: string) => {
    const contact = searchResults.find(c => c.email === email);
    selectContact(email, contact?.name, contact?.avatarUrl);
  };

  const handleContinueToPreferences = () => {
    if (selectedContacts.length > 0) {
      setPhase('preferences');
    }
  };

  // Loading state
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Checking connection...</p>
        </div>
      </div>
    );
  }

  // Activating screen
  if (phase === 'activating') {
    return <ActivatingScreen contactCount={selectedContacts.length} />;
  }

  // Get subtitle based on phase
  const getSubtitle = () => {
    switch (phase) {
      case 'contact-search':
        return 'Search and select contacts';
      case 'preferences':
        return `Configure ${selectedContacts.length} contact${selectedContacts.length !== 1 ? 's' : ''}`;
      case 'active':
        return `${monitoredContacts.length} contact${monitoredContacts.length !== 1 ? 's' : ''} monitored`;
      default:
        return 'Automatically save emails as memories';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* Header */}
      <div className={cn("relative px-5 pt-status-bar pb-6", gradientClasses.blue)}>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">Email Automation</h1>
            <p className="text-white/70 text-sm truncate">{getSubtitle()}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pt-5 h-[calc(100vh-180px)]">
        {phase === 'contact-search' && (
          <div className="flex flex-col h-full">
            <ContactSearch
              selectedEmails={selectedContacts.map(c => c.email)}
              searchResults={searchResults}
              isSearching={isSearching}
              maxEmails={50}
              onMaxEmailsChange={() => {}}
              onSearch={searchContacts}
              onSelect={handleContactSelect}
              onDeselect={deselectContact}
              onClear={clearSelection}
              onContinue={handleContinueToPreferences}
            />
            
            {/* Show "View Active" button if we have monitored contacts */}
            {monitoredContacts.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setPhase('active')}
                className="mt-4 w-full h-12 rounded-xl gap-2"
              >
                View {monitoredContacts.length} Active Contact{monitoredContacts.length !== 1 ? 's' : ''}
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}

        {phase === 'preferences' && (
          <ContactPreferences
            contacts={selectedContacts}
            onUpdatePreferences={updatePreferences}
            onActivate={activateMonitoring}
            isActivating={isActivating}
          />
        )}

        {phase === 'active' && (
          <ActiveMonitoring
            contacts={monitoredContacts}
            isLoading={isLoading}
            isCheckingStatus={isCheckingStatus}
            triggerStatuses={triggerStatuses}
            onAddMore={() => setPhase('contact-search')}
            onRemove={deactivateContact}
            onCheckStatus={checkTriggerStatus}
            onEnableTrigger={enableTrigger}
          />
        )}
      </div>
    </div>
  );
}
