import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getFlowConfig } from "@/data/flowConfigs";
import { useFlowState } from "@/hooks/useFlowState";
import { useLiamMemory } from "@/hooks/useLiamMemory";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { GeneratedMemory } from "@/types/flows";

// Flow components
import { FlowOverview } from "@/components/flows/FlowOverview";
import { FlowEntryList } from "@/components/flows/FlowEntryList";
import { FlowEntryForm } from "@/components/flows/FlowEntryForm";
import { FlowGenerating } from "@/components/flows/FlowGenerating";
import { FlowPreview } from "@/components/flows/FlowPreview";
import { FlowConfigured } from "@/components/flows/FlowConfigured";

export default function FlowPage() {
  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { createMemory } = useLiamMemory();
  
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
    toggleEditingMemory,
    setSavedMemoryIds,
    goToList,
    getEditingEntry,
  } = useFlowState();

  const [isConfirming, setIsConfirming] = useState(false);

  if (!config) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Flow not found</p>
      </div>
    );
  }

  const handleSaveEntry = (data: Record<string, string>) => {
    if (state.editingEntryId) {
      updateEntry(state.editingEntryId, data);
    } else {
      addEntry(data);
      setPhase('list');
    }
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

      if (error) {
        throw error;
      }

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

  const handleViewMemories = (entryId: string) => {
    // Navigate to memories page with filter
    navigate('/memories');
  };

  // Render based on current phase
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
          onSave={handleSaveEntry}
          onCancel={goToList}
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
          onAddEntry={startAdding}
          onEditEntry={startEditing}
          onViewMemories={handleViewMemories}
        />
      );

    default:
      return null;
  }
}
