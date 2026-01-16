import { useState, useEffect } from "react";
import { ChevronLeft, Plus, X } from "lucide-react";
import { FlowConfig, FlowEntry } from "@/types/flows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FlowEntryFormProps {
  config: FlowConfig;
  entry?: FlowEntry | null;
  onSave: (data: Record<string, string>) => void;
  onCancel: () => void;
}

const gradientClasses: Record<string, string> = {
  blue: "thread-gradient-blue",
  teal: "thread-gradient-teal",
  purple: "thread-gradient-purple",
  orange: "thread-gradient-orange",
  pink: "thread-gradient-pink",
};

// Quick select options for common relationships
const quickRelationships = [
  { label: "Mom", value: "Mom" },
  { label: "Dad", value: "Dad" },
  { label: "Sister", value: "Sister" },
  { label: "Brother", value: "Brother" },
  { label: "Spouse", value: "Spouse" },
  { label: "Child", value: "Child" },
  { label: "Grandma", value: "Grandma" },
  { label: "Grandpa", value: "Grandpa" },
  { label: "Other", value: "Other" },
];

export function FlowEntryForm({ config, entry, onSave, onCancel }: FlowEntryFormProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (entry) {
      setFormData(entry.data);
      const isQuickRelationship = quickRelationships.some(r => r.value === entry.data.relationship);
      setShowOtherInput(!isQuickRelationship && !!entry.data.relationship);
    } else {
      const initial: Record<string, string> = {};
      config.fields.forEach(field => {
        initial[field.id] = '';
      });
      setFormData(initial);
      setShowOtherInput(false);
    }
    setInputValues({});
  }, [entry, config.fields]);

  const handleChange = (fieldId: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleRelationshipSelect = (value: string) => {
    if (value === "Other") {
      setShowOtherInput(true);
      handleChange('relationship', '');
    } else {
      setShowOtherInput(false);
      handleChange('relationship', value);
    }
  };

  // For multitext and chips - parse comma-separated values
  const getArrayValue = (fieldId: string): string[] => {
    const value = formData[fieldId];
    if (!value) return [];
    return value.split('|||').filter(v => v.trim());
  };

  const addToArray = (fieldId: string, newValue: string) => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    
    const current = getArrayValue(fieldId);
    if (!current.includes(trimmed)) {
      const updated = [...current, trimmed].join('|||');
      handleChange(fieldId, updated);
    }
    setInputValues(prev => ({ ...prev, [fieldId]: '' }));
  };

  const removeFromArray = (fieldId: string, valueToRemove: string) => {
    const current = getArrayValue(fieldId);
    const updated = current.filter(v => v !== valueToRemove).join('|||');
    handleChange(fieldId, updated);
  };

  const toggleChip = (fieldId: string, chipValue: string) => {
    const current = getArrayValue(fieldId);
    if (current.includes(chipValue)) {
      removeFromArray(fieldId, chipValue);
    } else {
      addToArray(fieldId, chipValue);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const isValid = config.fields
    .filter(f => f.required)
    .every(f => formData[f.id]?.trim());

  const Icon = config.icon;

  const renderField = (field: typeof config.fields[0]) => {
    // Special handling for relationship field - use quick select chips
    if (field.id === 'relationship') {
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {quickRelationships.map(rel => (
              <button
                key={rel.value}
                type="button"
                onClick={() => handleRelationshipSelect(rel.value)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all",
                  (formData.relationship === rel.value || (rel.value === "Other" && showOtherInput))
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {rel.label}
              </button>
            ))}
          </div>
          {showOtherInput && (
            <Input
              placeholder="Enter relationship"
              value={formData.relationship || ''}
              onChange={(e) => handleChange('relationship', e.target.value)}
              className="h-12"
              autoFocus
            />
          )}
        </div>
      );
    }

    // Multitext field - add multiple items
    if (field.type === 'multitext') {
      const items = getArrayValue(field.id);
      const inputValue = inputValues[field.id] || '';
      
      return (
        <div className="space-y-3">
          {field.hint && (
            <p className="text-xs text-muted-foreground">{field.hint}</p>
          )}
          
          {/* Tags display */}
          {items.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {items.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium"
                >
                  {item}
                  <button
                    type="button"
                    onClick={() => removeFromArray(field.id, item)}
                    className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          
          {/* Input with add button */}
          <div className="flex gap-2">
            <Input
              placeholder={field.placeholder}
              value={inputValue}
              onChange={(e) => setInputValues(prev => ({ ...prev, [field.id]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addToArray(field.id, inputValue);
                }
              }}
              className="h-11 flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-11 w-11 shrink-0"
              onClick={() => addToArray(field.id, inputValue)}
              disabled={!inputValue.trim()}
            >
              <Plus className="w-5 h-5" />
            </Button>
          </div>
        </div>
      );
    }

    // Chips field - pre-defined options with multi-select
    if (field.type === 'chips' && field.options) {
      const selected = getArrayValue(field.id);
      const inputValue = inputValues[field.id] || '';
      
      // Get custom items (items not in predefined options)
      const customItems = selected.filter(s => !field.options?.includes(s));
      
      return (
        <div className="space-y-3">
          {field.hint && (
            <p className="text-xs text-muted-foreground">{field.hint}</p>
          )}
          
          {/* Predefined options */}
          <div className="flex flex-wrap gap-2">
            {field.options.map(option => {
              const isSelected = selected.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleChip(field.id, option)}
                  className={cn(
                    "px-3.5 py-2 rounded-full text-sm font-medium transition-all border",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:border-primary/50"
                  )}
                >
                  {option}
                </button>
              );
            })}
          </div>
          
          {/* Custom items display */}
          {customItems.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {customItems.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-medium"
                >
                  {item}
                  <button
                    type="button"
                    onClick={() => removeFromArray(field.id, item)}
                    className="hover:bg-primary-foreground/20 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          
          {/* Add custom option */}
          <div className="flex gap-2">
            <Input
              placeholder={field.placeholder}
              value={inputValue}
              onChange={(e) => setInputValues(prev => ({ ...prev, [field.id]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addToArray(field.id, inputValue);
                }
              }}
              className="h-10 flex-1 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 px-3"
              onClick={() => addToArray(field.id, inputValue)}
              disabled={!inputValue.trim()}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
        </div>
      );
    }

    if (field.type === 'text') {
      return (
        <Input
          id={field.id}
          placeholder={field.placeholder}
          value={formData[field.id] || ''}
          onChange={(e) => handleChange(field.id, e.target.value)}
          className="h-12"
        />
      );
    }

    if (field.type === 'textarea') {
      return (
        <Textarea
          id={field.id}
          placeholder={field.placeholder}
          value={formData[field.id] || ''}
          onChange={(e) => handleChange(field.id, e.target.value)}
          className="min-h-[100px] resize-none"
        />
      );
    }

    if (field.type === 'date') {
      return (
        <Input
          id={field.id}
          type="date"
          placeholder={field.placeholder}
          value={formData[field.id] || ''}
          onChange={(e) => handleChange(field.id, e.target.value)}
          className="h-12"
        />
      );
    }

    // Default select for other select fields
    if (field.type === 'select' && field.options) {
      return (
        <div className="flex flex-wrap gap-2">
          {field.options.map(option => (
            <button
              key={option}
              type="button"
              onClick={() => handleChange(field.id, option)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all",
                formData[field.id] === option
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {option}
            </button>
          ))}
        </div>
      );
    }

    return null;
  };

  // Group fields by section
  const getFieldsBySection = () => {
    const sections: { name: string | null; fields: typeof config.fields }[] = [];
    let currentSection: string | null = null;
    let currentFields: typeof config.fields = [];

    config.fields.forEach(field => {
      if (field.section && field.section !== currentSection) {
        if (currentFields.length > 0) {
          sections.push({ name: currentSection, fields: currentFields });
        }
        currentSection = field.section;
        currentFields = [field];
      } else {
        currentFields.push(field);
      }
    });

    if (currentFields.length > 0) {
      sections.push({ name: currentSection, fields: currentFields });
    }

    return sections;
  };

  const sections = getFieldsBySection();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className={cn("relative px-5 pt-12 pb-6", gradientClasses[config.gradient])}>
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">
              {entry ? 'Edit' : config.singleEntry ? 'Configure' : 'Add'} {config.entryName}
            </h1>
            <p className="text-white/70 text-sm truncate">
              {config.singleEntry ? config.description : 'Fill in the details below'}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 px-5 py-5 pb-32 overflow-auto">
        {sections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="mb-6">
            {section.name && (
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-1">
                {section.name}
              </h3>
            )}
            <div className="space-y-5">
              {section.fields.map(field => (
                <div key={field.id} className="space-y-2">
                  <Label htmlFor={field.id} className="text-sm font-medium">
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  {renderField(field)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </form>

      {/* Save Button */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-background via-background to-transparent pt-10">
        <Button
          onClick={handleSubmit}
          disabled={!isValid}
          className="w-full h-12 text-base font-medium"
        >
          {entry ? 'Save Changes' : config.singleEntry ? 'Save Preferences' : `Add ${config.entryName}`}
        </Button>
      </div>
    </div>
  );
}