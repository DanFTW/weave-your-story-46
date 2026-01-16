import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Inbox, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEmailDump } from "@/hooks/useEmailDump";
import { useComposio } from "@/hooks/useComposio";
import { ContactSearch } from "./ContactSearch";
import { EmailExtracting } from "./EmailExtracting";
import { EmailPreviewList } from "./EmailPreviewList";
import { EmailDumpSuccess } from "./EmailDumpSuccess";

const gradientClasses: Record<string, string> = {
  blue: "thread-gradient-blue",
  teal: "thread-gradient-teal",
  purple: "thread-gradient-purple",
  orange: "thread-gradient-orange",
  pink: "thread-gradient-pink",
};

export function EmailDumpFlow() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const gmail = useComposio('GMAIL');
  
  const {
    phase,
    setPhase,
    selectedEmails,
    searchResults,
    extractedEmails,
    savedCount,
    isSearching,
    isExtracting,
    isSaving,
    searchContacts,
    selectEmail,
    deselectEmail,
    clearSelection,
    extractEmails,
    removeExtractedEmail,
    updateExtractedEmail,
    updateExtractedEmailTag,
    toggleEditingEmail,
    saveAsMemories,
    reset,
  } = useEmailDump();

  // Check for OAuth callback first
  useEffect(() => {
    const connected = searchParams.get('connected');
    const connectionId = searchParams.get('connectionId');
    
    if (connected === 'true' && connectionId) {
      gmail.completeConnection(connectionId).then(() => {
        // Clear URL params
        window.history.replaceState({}, '', '/flow/email-dump');
        setIsCheckingAuth(false);
      });
    }
  }, [searchParams, gmail]);

  // Check Gmail connection status on mount
  useEffect(() => {
    const checkAuth = async () => {
      await gmail.checkStatus();
      setIsCheckingAuth(false);
    };
    
    // Only check if not handling OAuth callback
    const connected = searchParams.get('connected');
    if (!connected) {
      checkAuth();
    }
  }, []);

  // Handle connection status changes
  useEffect(() => {
    if (isCheckingAuth) return;
    
    if (gmail.isConnected) {
      // User is connected, go to contact search
      if (phase === 'auth-check') {
        setPhase('contact-search');
      }
    } else {
      // User is not connected, redirect to the Gmail integration page
      navigate('/integration/gmail');
    }
  }, [gmail.isConnected, isCheckingAuth, phase, setPhase, navigate]);

  const handleBack = () => {
    switch (phase) {
      case 'auth-check':
        navigate('/threads');
        break;
      case 'contact-search':
        navigate('/threads');
        break;
      case 'extracting':
        setPhase('contact-search');
        break;
      case 'preview':
        setPhase('contact-search');
        break;
      case 'success':
        reset();
        break;
      default:
        navigate('/threads');
    }
  };

  // Show loading while checking auth
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

  // Success screen (full screen, no header)
  if (phase === 'success') {
    return (
      <EmailDumpSuccess
        savedCount={savedCount}
        onExtractMore={reset}
      />
    );
  }

  // Extracting screen (full screen loading)
  if (phase === 'extracting') {
    return <EmailExtracting selectedCount={selectedEmails.length} />;
  }

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* Header */}
      <div className={cn("relative px-5 pt-12 pb-6", gradientClasses.blue)}>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
            <Inbox className="w-6 h-6 text-white" />
          </div>
          
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">Email Dump</h1>
            <p className="text-white/70 text-sm truncate">
              {phase === 'contact-search' && 'Select email addresses'}
              {phase === 'preview' && `${extractedEmails.length} emails to save`}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pt-5">
        {phase === 'contact-search' && (
          <ContactSearch
            selectedEmails={selectedEmails}
            searchResults={searchResults}
            isSearching={isSearching}
            onSearch={searchContacts}
            onSelect={selectEmail}
            onDeselect={deselectEmail}
            onClear={clearSelection}
            onContinue={extractEmails}
          />
        )}

        {phase === 'preview' && (
          <EmailPreviewList
            emails={extractedEmails}
            onDelete={removeExtractedEmail}
            onUpdate={updateExtractedEmail}
            onUpdateTag={updateExtractedEmailTag}
            onToggleEdit={toggleEditingEmail}
            onConfirm={saveAsMemories}
            onBack={() => setPhase('contact-search')}
            isSaving={isSaving}
          />
        )}
      </div>
    </div>
  );
}
