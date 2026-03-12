import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { getFlowConfig } from "@/data/flowConfigs";
import { useFlowState } from "@/hooks/useFlowState";
import { useLiamMemory } from "@/hooks/useLiamMemory";
import { useReceiptUpload, ReceiptData } from "@/hooks/useReceiptUpload";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { GeneratedMemory } from "@/types/flows";
import { LLMImportCategory, LLMImportPhase } from "@/types/llmImport";
import { parseMemories } from "@/utils/parseMemories";
import { cn } from "@/lib/utils";

// Flow components
import { FlowEntryList } from "@/components/flows/FlowEntryList";
import { FlowEntryForm } from "@/components/flows/FlowEntryForm";
import { FlowGenerating } from "@/components/flows/FlowGenerating";
import { FlowPreview } from "@/components/flows/FlowPreview";
import { FlowConfigured } from "@/components/flows/FlowConfigured";

// Receipt-specific components
import { ReceiptUploader } from "@/components/flows/ReceiptUploader";
import { ReceiptPreview } from "@/components/flows/ReceiptPreview";
import { ReceiptMemoryList } from "@/components/flows/ReceiptMemoryList";

// LLM Import components
import { LLMImportCategoryList } from "@/components/flows/llm-import/LLMImportCategoryList";
import { LLMImportConfig } from "@/components/flows/llm-import/LLMImportConfig";
import { LLMImportSuccess } from "@/components/flows/llm-import/LLMImportSuccess";

// Email Dump components
import { EmailDumpFlow } from "@/components/flows/email-dump/EmailDumpFlow";

// Email Automation components
import { EmailAutomationFlow } from "@/components/flows/email-automation";

// Google Photos Sync components
import { GooglePhotosSyncFlow } from "@/components/flows/google-photos-sync";

// Instagram Sync components
import { InstagramSyncFlow } from "@/components/flows/instagram-sync";

// Instagram Automation components
import { InstagramAutomationFlow } from "@/components/flows/instagram-automation";

// Twitter Sync components
import { TwitterSyncFlow } from "@/components/flows/twitter-sync";

// Twitter Automation components
import { TwitterAutomationFlow } from "@/components/flows/twitter-automation";

// YouTube Sync components
import { YouTubeSyncFlow } from "@/components/flows/youtube-sync";

// LinkedIn Automation components
import { LinkedInAutomationFlow } from "@/components/flows/linkedin-automation";

// Trello Automation components
import { TrelloAutomationFlow } from "@/components/flows/trello-automation";

// HubSpot Automation components
import { HubSpotAutomationFlow } from "@/components/flows/hubspot-automation";

// Twitter Alpha Tracker components
import { TwitterAlphaTrackerFlow } from "@/components/flows/twitter-alpha-tracker";

// Todoist Automation components
import { TodoistAutomationFlow } from "@/components/flows/todoist-automation";

// Fireflies Automation components
import { FirefliesAutomationFlow } from "@/components/flows/fireflies-automation";

// Google Drive Automation components
import { GoogleDriveAutomationFlow } from "@/components/flows/googledrive-automation";

// Discord Automation components
import { DiscordAutomationFlow } from "@/components/flows/discord-automation";

// Birthday Reminder components
import { BirthdayReminderFlow } from "@/components/flows/birthday-reminder";

// Calendar Event Sync components
import { CalendarEventSyncFlow } from "@/components/flows/calendar-event-sync";

// Restaurant Bookmark Sync components
import { RestaurantBookmarkSyncFlow } from "@/components/flows/restaurant-bookmark-sync";

// Grocery Sheet Sync components
import { GrocerySheetSyncFlow } from "@/components/flows/grocery-sheet-sync";

// Coinbase Trades components
import { CoinbaseTradesFlow } from "@/components/flows/coinbase-trades";

// Instagram Analytics components
import { InstagramAnalyticsFlow } from "@/components/flows/instagram-analytics";

// Facebook Page Posts components
import { FacebookPagePostsFlow } from "@/components/flows/facebook-page-posts";

// Facebook Sync components
import { FacebookSyncFlow } from "@/components/flows/facebook-sync";

// Website Scrape components
import { WebsiteScrapeFlow } from "@/components/flows/website-scrape";

// LinkedIn Profile Scrape components
import { LinkedInProfileScrapeFlow } from "@/components/flows/linkedin-profile-scrape";

// Slack Messages Sync components
import { SlackMessagesSyncFlow } from "@/components/flows/slack-messages-sync";

// Gradient class mapping
const gradientClasses: Record<string, string> = {
  blue: "thread-gradient-blue",
  teal: "thread-gradient-teal",
  purple: "thread-gradient-purple",
  orange: "thread-gradient-orange",
  pink: "thread-gradient-pink",
};

export default function FlowPage() {
  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { createMemory } = useLiamMemory();
  const { processReceipt, isProcessing } = useReceiptUpload();
  const [isConfirming, setIsConfirming] = useState(false);
  
  // Receipt-specific state
  const [receiptPhase, setReceiptPhase] = useState<'list' | 'upload' | 'preview'>('list');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  
  // LLM Import state
  const [llmImportPhase, setLLMImportPhase] = useState<LLMImportPhase>('category-select');
  const [selectedCategory, setSelectedCategory] = useState<LLMImportCategory | null>(null);
  const [llmSavedCount, setLLMSavedCount] = useState(0);
  const [isProcessingLLM, setIsProcessingLLM] = useState(false);
  const [llmGeneratedMemories, setLLMGeneratedMemories] = useState<GeneratedMemory[]>([]);
  
  const config = flowId ? getFlowConfig(flowId) : undefined;
  const {
    state,
    setPhase,
    addEntry,
    updateEntry,
    deleteEntry,
    startEditing,
    startAdding,
    setGeneratedMemories,
    deleteGeneratedMemory,
    updateGeneratedMemory,
    updateGeneratedMemoryTag,
    toggleEditingMemory,
    setSavedMemoryIds,
    goToList,
    getEditingEntry,
  } = useFlowState(flowId);

  // Early return AFTER all hooks have been called
  if (!config) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Flow not found</p>
      </div>
    );
  }

  // === RECEIPT FLOW HANDLERS ===
  
  const handleImageSelected = (file: File, base64: string) => {
    setSelectedFile(file);
    setSelectedImage(base64);
  };

  const handleScanReceipt = async () => {
    if (!selectedImage) return;
    
    const data = await processReceipt(selectedImage);
    if (data) {
      setReceiptData(data);
      setReceiptPhase('preview');
    }
  };

  const handleSaveReceipt = async (memoryString: string) => {
    setIsConfirming(true);
    
    try {
      const success = await createMemory(memoryString, 'RECEIPTS');
      
      if (success) {
        toast({
          title: "Receipt saved",
          description: "Your purchase has been added to memory.",
        });
        // Reset and go back to list
        setReceiptPhase('list');
        setSelectedImage(null);
        setSelectedFile(null);
        setReceiptData(null);
      }
    } catch (error) {
      console.error('Failed to save receipt:', error);
      toast({
        title: "Save failed",
        description: "Could not save the receipt. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConfirming(false);
    }
  };

  const handleRetakeReceipt = () => {
    setReceiptPhase('upload');
    setReceiptData(null);
  };

  const handleClearImage = () => {
    setSelectedImage(null);
    setSelectedFile(null);
  };

  // === EMAIL DUMP FLOW RENDER ===
  
  if (config.isEmailDumpFlow) {
    return <EmailDumpFlow />;
  }

  // === EMAIL AUTOMATION FLOW RENDER ===
  
  if (config.isEmailAutomationFlow) {
    return <EmailAutomationFlow />;
  }

  // === GOOGLE PHOTOS SYNC FLOW RENDER ===
  
  if (config.isGooglePhotosSyncFlow) {
    return <GooglePhotosSyncFlow />;
  }

  // === INSTAGRAM SYNC FLOW RENDER ===
  
  if (config.isInstagramSyncFlow) {
    return <InstagramSyncFlow />;
  }

  // === INSTAGRAM AUTOMATION FLOW RENDER ===
  
  if (config.isInstagramAutomationFlow) {
    return <InstagramAutomationFlow />;
  }

  // === TWITTER SYNC FLOW RENDER ===
  
  if (config.isTwitterSyncFlow) {
    return <TwitterSyncFlow />;
  }

  // === TWITTER AUTOMATION FLOW RENDER ===
  
  if (config.isTwitterAutomationFlow) {
    return <TwitterAutomationFlow />;
  }

  // === YOUTUBE SYNC FLOW RENDER ===
  
  if (config.isYouTubeSyncFlow) {
    return <YouTubeSyncFlow />;
  }

  // === LINKEDIN AUTOMATION FLOW RENDER ===
  
  if (config.isLinkedInAutomationFlow) {
    return <LinkedInAutomationFlow />;
  }

  // === TRELLO AUTOMATION FLOW RENDER ===
  
  if (config.isTrelloAutomationFlow) {
    return <TrelloAutomationFlow />;
  }

  // === HUBSPOT AUTOMATION FLOW RENDER ===
  
  if (config.isHubSpotAutomationFlow) {
    return <HubSpotAutomationFlow />;
  }

  // === TWITTER ALPHA TRACKER FLOW RENDER ===
  
  if (config.isTwitterAlphaTrackerFlow) {
    return <TwitterAlphaTrackerFlow />;
  }

  // === TODOIST AUTOMATION FLOW RENDER ===
  
  if (config.isTodoistAutomationFlow) {
    return <TodoistAutomationFlow />;
  }

  // === FIREFLIES AUTOMATION FLOW RENDER ===

  if (config.isFirefliesAutomationFlow) {
    return <FirefliesAutomationFlow />;
  }

  // === GOOGLE DRIVE AUTOMATION FLOW RENDER ===

  if (config.isGoogleDriveAutomationFlow) {
    return <GoogleDriveAutomationFlow />;
  }

  // === DISCORD AUTOMATION FLOW RENDER ===

   if (config.isDiscordAutomationFlow) {
    return <DiscordAutomationFlow />;
  }

  // === SLACK MESSAGES SYNC FLOW RENDER ===

  if (config.isSlackMessagesSyncFlow) {
    return <SlackMessagesSyncFlow />;
  }

  // === BIRTHDAY REMINDER FLOW RENDER ===

  if (config.isBirthdayReminderFlow) {
    return <BirthdayReminderFlow />;
  }

  // === CALENDAR EVENT SYNC FLOW RENDER ===

  if (config.isCalendarEventSyncFlow) {
    return <CalendarEventSyncFlow />;
  }

  // === RESTAURANT BOOKMARK SYNC FLOW RENDER ===

  if (config.isRestaurantBookmarkSyncFlow) {
    return <RestaurantBookmarkSyncFlow />;
  }

  // === GROCERY SHEET SYNC FLOW RENDER ===

  if (config.isGrocerySheetSyncFlow) {
    return <GrocerySheetSyncFlow />;
  }

  // === COINBASE TRADES FLOW RENDER ===

  if (config.isCoinbaseTradesFlow) {
    return <CoinbaseTradesFlow />;
  }

  // === INSTAGRAM ANALYTICS FLOW RENDER ===

  if (config.isInstagramAnalyticsFlow) {
    return <InstagramAnalyticsFlow />;
  }

  // === FACEBOOK PAGE POSTS FLOW RENDER ===

  if (config.isFacebookPagePostsFlow) {
    return <FacebookPagePostsFlow />;
  }

  // === FACEBOOK SYNC FLOW RENDER ===

  if (config.isFacebookSyncFlow) {
    return <FacebookSyncFlow />;
  }

  // === WEBSITE SCRAPE FLOW RENDER ===

  if (config.isWebsiteScrapeFlow) {
    return <WebsiteScrapeFlow />;
  }

  // === LINKEDIN PROFILE SCRAPE FLOW RENDER ===

  if (config.isLinkedInProfileScrapeFlow) {
    return <LinkedInProfileScrapeFlow />;
  }

  // === RECEIPT FLOW RENDER ===
  
  if (config.isReceiptFlow) {
    const Icon = config.icon;
    
    return (
      <div className="min-h-screen bg-background pb-nav">
        {/* Header */}
        <div className={cn("relative px-5 pt-status-bar pb-6", gradientClasses[config.gradient])}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => receiptPhase === 'list' ? navigate('/threads') : setReceiptPhase('list')}
              className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">{config.title}</h1>
              <p className="text-white/70 text-sm truncate">{config.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 pt-5">
          {receiptPhase === 'list' && (
            <ReceiptMemoryList onAddNew={() => setReceiptPhase('upload')} />
          )}
          
          {receiptPhase === 'upload' && (
            <ReceiptUploader
              onImageSelected={handleImageSelected}
              onScan={handleScanReceipt}
              isProcessing={isProcessing}
              selectedImage={selectedImage}
              onClear={handleClearImage}
            />
          )}
          
          {receiptPhase === 'preview' && receiptData && (
            <ReceiptPreview
              data={receiptData}
              imageUrl={selectedImage || undefined}
              onSave={handleSaveReceipt}
              onRetake={handleRetakeReceipt}
              isSaving={isConfirming}
            />
          )}
        </div>
      </div>
    );
  }

  // === LLM IMPORT FLOW HANDLERS ===

  const handleSelectCategory = (category: LLMImportCategory) => {
    setSelectedCategory(category);
    setLLMImportPhase('configure');
  };

  const handleProcessLLMContent = (content: string) => {
    if (!selectedCategory) return;
    
    setIsProcessingLLM(true);
    
    try {
      const memories = parseMemories(content);
      
      if (memories.length === 0) {
        toast({
          title: "No memories found",
          description: "Could not extract any memories from the response. Make sure the format is correct.",
          variant: "destructive",
        });
        setIsProcessingLLM(false);
        return;
      }

      // Convert to GeneratedMemory format for preview
      const generatedMemories: GeneratedMemory[] = memories.map((memory, index) => ({
        id: `llm-${Date.now()}-${index}`,
        content: memory,
        tag: selectedCategory.memoryTag.toUpperCase(),
        entryId: 'llm-import',
        entryName: selectedCategory.title,
        isEditing: false,
      }));

      setLLMGeneratedMemories(generatedMemories);
      setLLMImportPhase('preview');
    } catch (error) {
      console.error('LLM parse error:', error);
      toast({
        title: "Parse failed",
        description: "Failed to parse the LLM response",
        variant: "destructive",
      });
    } finally {
      setIsProcessingLLM(false);
    }
  };

  const handleConfirmLLMMemories = async () => {
    if (!selectedCategory) return;
    
    setIsConfirming(true);
    
    try {
      let savedCount = 0;
      for (const memory of llmGeneratedMemories) {
        const success = await createMemory(memory.content, memory.tag, { silent: true });
        if (success) savedCount++;
      }

      if (savedCount > 0) {
        setLLMSavedCount(savedCount);
        setLLMImportPhase('success');
      } else {
        throw new Error('Failed to save memories');
      }
    } catch (error) {
      console.error('LLM import error:', error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Failed to save memories",
        variant: "destructive",
      });
    } finally {
      setIsConfirming(false);
    }
  };

  const handleDeleteLLMMemory = (id: string) => {
    setLLMGeneratedMemories(prev => prev.filter(m => m.id !== id));
  };

  const handleUpdateLLMMemory = (id: string, content: string) => {
    setLLMGeneratedMemories(prev => 
      prev.map(m => m.id === id ? { ...m, content, isEditing: false } : m)
    );
  };

  const handleUpdateLLMMemoryTag = (id: string, tag: string) => {
    setLLMGeneratedMemories(prev => 
      prev.map(m => m.id === id ? { ...m, tag } : m)
    );
  };

  const handleToggleLLMMemoryEdit = (id: string, isEditing: boolean) => {
    setLLMGeneratedMemories(prev => 
      prev.map(m => m.id === id ? { ...m, isEditing } : m)
    );
  };

  const handleImportMore = () => {
    setSelectedCategory(null);
    setLLMImportPhase('category-select');
    setLLMSavedCount(0);
    setLLMGeneratedMemories([]);
  };

  // === LLM IMPORT FLOW RENDER ===

  if (config.isLLMImportFlow) {
    const Icon = config.icon;

    // Success phase
    if (llmImportPhase === 'success' && selectedCategory) {
      return (
        <LLMImportSuccess
          savedCount={llmSavedCount}
          categoryTitle={selectedCategory.title}
          onImportMore={handleImportMore}
        />
      );
    }

    // Preview phase
    if (llmImportPhase === 'preview' && selectedCategory) {
      return (
        <FlowPreview
          config={config}
          memories={llmGeneratedMemories}
          onDelete={handleDeleteLLMMemory}
          onUpdate={handleUpdateLLMMemory}
          onUpdateTag={handleUpdateLLMMemoryTag}
          onToggleEdit={handleToggleLLMMemoryEdit}
          onConfirm={handleConfirmLLMMemories}
          onBack={() => setLLMImportPhase('configure')}
          isConfirming={isConfirming}
        />
      );
    }

    // Configure phase
    if (llmImportPhase === 'configure' && selectedCategory) {
      return (
        <LLMImportConfig
          category={selectedCategory}
          onBack={() => setLLMImportPhase('category-select')}
          onProcess={handleProcessLLMContent}
          isProcessing={isProcessingLLM}
        />
      );
    }

    // Category select phase (default)
    return (
      <div className="min-h-screen bg-background pb-nav">
        {/* Header */}
        <div className={cn("relative px-5 pt-status-bar pb-6", gradientClasses[config.gradient])}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/threads')}
              className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">{config.title}</h1>
              <p className="text-white/70 text-sm truncate">{config.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Category List */}
        <div className="pt-5">
          <LLMImportCategoryList onSelectCategory={handleSelectCategory} />
        </div>
      </div>
    );
  }

  // === STANDARD FLOW HANDLERS ===

  const handleSaveEntry = (data: Record<string, string>) => {
    if (config.singleEntry && state.entries.length > 0) {
      updateEntry(state.entries[0].id, data);
    } else if (state.editingEntryId) {
      updateEntry(state.editingEntryId, data);
    } else {
      addEntry(data);
    }
    setPhase('list');
  };

  const handleGenerate = async () => {
    setPhase('generating');

    try {
      const { data, error } = await supabase.functions.invoke('generate-memories', {
        body: {
          flowType: config.id,
          entryName: config.entryName,
          entryNamePlural: config.entryNamePlural,
          entries: state.entries,
          memoryTag: config.memoryTag,
        },
      });

      if (error) throw error;

      if (data?.memories) {
        setGeneratedMemories(data.memories as GeneratedMemory[]);
      } else {
        throw new Error('No memories generated');
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate memories",
        variant: "destructive",
      });
      setPhase('list');
    }
  };

  const handleConfirmMemories = async () => {
    setIsConfirming(true);

    try {
      const savedIds: string[] = [];
      
      for (const memory of state.generatedMemories) {
        const success = await createMemory(memory.content, memory.tag, { silent: true });
        if (success) {
          savedIds.push(memory.id);
        }
      }

      if (savedIds.length > 0) {
        toast({
          title: "Memories saved",
          description: `Successfully saved ${savedIds.length} memories`,
        });
        setSavedMemoryIds(savedIds);
      } else {
        throw new Error('Failed to save any memories');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save memories",
        variant: "destructive",
      });
    } finally {
      setIsConfirming(false);
    }
  };

  const handleViewMemories = () => {
    navigate('/memories');
  };

  // === STANDARD FLOW RENDER ===
  
  switch (state.phase) {
    case 'adding':
      return (
        <FlowEntryForm
          config={config}
          entry={config.singleEntry && state.entries.length > 0 ? state.entries[0] : undefined}
          onSave={handleSaveEntry}
          onCancel={() => state.entries.length > 0 ? goToList() : navigate('/threads')}
        />
      );

    case 'editing':
      return (
        <FlowEntryForm
          config={config}
          entry={getEditingEntry()}
          onSave={handleSaveEntry}
          onCancel={goToList}
        />
      );

    case 'list':
      return (
        <FlowEntryList
          config={config}
          entries={state.entries}
          onAddEntry={startAdding}
          onEditEntry={startEditing}
          onDeleteEntry={deleteEntry}
          onGenerate={handleGenerate}
        />
      );

    case 'generating':
      return (
        <FlowGenerating
          config={config}
          entryCount={state.entries.length}
        />
      );

    case 'preview':
      return (
        <FlowPreview
          config={config}
          memories={state.generatedMemories}
          onDelete={deleteGeneratedMemory}
          onUpdate={updateGeneratedMemory}
          onUpdateTag={updateGeneratedMemoryTag}
          onToggleEdit={toggleEditingMemory}
          onConfirm={handleConfirmMemories}
          onBack={() => setPhase('list')}
          isConfirming={isConfirming}
        />
      );

    case 'configured':
      return (
        <FlowConfigured
          config={config}
          entries={state.entries}
          savedMemories={state.generatedMemories}
          onAddEntry={startAdding}
          onEditEntry={startEditing}
        />
      );

    default:
      return null;
  }
}
