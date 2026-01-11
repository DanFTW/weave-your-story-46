import { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { FlowConfig, FlowEntry } from "@/types/flows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export function FlowEntryForm({ config, entry, onSave, onCancel }: FlowEntryFormProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});

  useEffect(() => {
    if (entry) {
      setFormData(entry.data);
    } else {
      // Initialize with empty strings
      const initial: Record<string, string> = {};
      config.fields.forEach(field => {
        initial[field.id] = '';
      });
      setFormData(initial);
    }
  }, [entry, config.fields]);

  const handleChange = (fieldId: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const isValid = config.fields
    .filter(f => f.required)
    .every(f => formData[f.id]?.trim());

  const Icon = config.icon;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className={cn("relative px-5 pt-12 pb-6", gradientClasses[config.gradient])}>
        <button
          onClick={onCancel}
          className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center mb-4"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Icon className="w-6 h-6 text-white" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              {entry ? 'Edit' : 'Add'} {config.entryName}
            </h1>
            <p className="text-white/70 text-sm">Fill in the details below</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 px-5 py-6 pb-32">
        <div className="space-y-5">
          {config.fields.map(field => (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.id} className="text-sm font-medium">
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              
              {field.type === 'text' && (
                <Input
                  id={field.id}
                  placeholder={field.placeholder}
                  value={formData[field.id] || ''}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  className="h-12"
                />
              )}
              
              {field.type === 'textarea' && (
                <Textarea
                  id={field.id}
                  placeholder={field.placeholder}
                  value={formData[field.id] || ''}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  className="min-h-[100px] resize-none"
                />
              )}
              
              {field.type === 'date' && (
                <Input
                  id={field.id}
                  type="date"
                  placeholder={field.placeholder}
                  value={formData[field.id] || ''}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  className="h-12"
                />
              )}
              
              {field.type === 'select' && field.options && (
                <Select
                  value={formData[field.id] || ''}
                  onValueChange={(value) => handleChange(field.id, value)}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder={field.placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map(option => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}
        </div>
      </form>

      {/* Save Button */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-background via-background to-transparent pt-10">
        <Button
          onClick={handleSubmit}
          disabled={!isValid}
          className="w-full h-12 text-base font-medium"
        >
          {entry ? 'Save Changes' : `Add ${config.entryName}`}
        </Button>
      </div>
    </div>
  );
}
