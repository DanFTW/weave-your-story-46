import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Receipt } from "lucide-react";
import { getFlowConfig } from "@/data/flowConfigs";
import { useFlowState } from "@/hooks/useFlowState";
import { useLiamMemory } from "@/hooks/useLiamMemory";
import { useReceiptUpload, ReceiptData } from "@/hooks/useReceiptUpload";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { GeneratedMemory } from "@/types/flows";
import { cn } from "@/lib/utils";

// Flow components
import { FlowOverview } from "@/components/flows/FlowOverview";
import { FlowEntryList } from "@/components/flows/FlowEntryList";
import { FlowEntryForm } from "@/components/flows/FlowEntryForm";
import { FlowGenerating } from "@/components/flows/FlowGenerating";
import { FlowPreview } from "@/components/flows/FlowPreview";
import { FlowConfigured } from "@/components/flows/FlowConfigured";

// Receipt-specific components
import { ReceiptUploader } from "@/components/flows/ReceiptUploader";
import { ReceiptPreview } from "@/components/flows/ReceiptPreview";
import { ReceiptMemoryList } from "@/components/flows/ReceiptMemoryList";

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

  // === RECEIPT FLOW RENDER ===
  
  if (config.isReceiptFlow) {
    const Icon = config.icon;
    
    return (
      <div className="min-h-screen bg-background pb-nav">
        {/* Header */}
        <div className={cn("relative px-5 pt-12 pb-6", gradientClasses[config.gradient])}>
          <button
            onClick={() => receiptPhase === 'list' ? navigate('/threads') : setReceiptPhase('list')}
            className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center mb-4"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{config.title}</h1>
              <p className="text-white/70 text-sm">{config.subtitle}</p>
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
        const success = await createMemory(memory.content, memory.tag);
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
    case 'overview':
      return (
        <FlowOverview
          config={config}
          onAddEntry={startAdding}
        />
      );

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
