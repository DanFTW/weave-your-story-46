import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEmailDump } from "@/hooks/useEmailDump";
import { useComposio } from "@/hooks/useComposio";
import { GmailAuthGate } from "./GmailAuthGate";
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

  // Check for OAuth callback
  useEffect(() => {
    const connected = searchParams.get('connected');
    const connectionId = searchParams.get('connectionId');
    
    if (connected === 'true' && connectionId) {
      gmail.completeConnection(connectionId).then(() => {
        // Clear URL params
        window.history.replaceState({}, '', '/flow/email-dump');
      });
    }
  }, [searchParams, gmail]);

  // Check Gmail connection status on mount
  useEffect(() => {
    gmail.checkStatus();
  }, []);

  // Move to contact search when Gmail is connected
  useEffect(() => {
    if (gmail.isConnected && phase === 'auth-check') {
      setPhase('contact-search');
    }
  }, [gmail.isConnected, phase, setPhase]);

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
        <button
          onClick={handleBack}
          className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center mb-4"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Inbox className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Email Dump</h1>
            <p className="text-white/70 text-sm">
              {phase === 'auth-check' && 'Connect your Gmail'}
              {phase === 'contact-search' && 'Select email addresses'}
              {phase === 'preview' && `${extractedEmails.length} emails to save`}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pt-5">
        {phase === 'auth-check' && (
          <GmailAuthGate
            isConnected={gmail.isConnected}
            isConnecting={gmail.connecting}
            connectedAccount={gmail.connectedAccount}
            onConnect={() => gmail.connect('/flow/email-dump')}
            onContinue={() => setPhase('contact-search')}
          />
        )}

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
