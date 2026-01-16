import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Camera, Upload, Image as ImageIcon, X, Loader2, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ACCEPTED_TYPES, MAX_FILE_SIZE } from "@/hooks/useReceiptUpload";

interface ReceiptUploaderProps {
  onImageSelected: (file: File, base64: string) => void;
  onScan: () => void;
  isProcessing: boolean;
  selectedImage: string | null;
  onClear: () => void;
}

export function ReceiptUploader({
  onImageSelected,
  onScan,
  isProcessing,
  selectedImage,
  onClear,
}: ReceiptUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const validateAndProcessFile = useCallback(async (file: File) => {
    setError(null);

    // Validate type
    if (!ACCEPTED_TYPES.includes(file.type.toLowerCase())) {
      setError('Please upload a JPEG, PNG, or WebP image.');
      return;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      setError('Image is too large. Maximum size is 10MB.');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      onImageSelected(file, base64);
    };
    reader.onerror = () => {
      setError('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  }, [onImageSelected]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndProcessFile(file);
    }
    // Reset input value to allow re-selecting the same file
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndProcessFile(file);
    }
  };

  const handleUploadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleCameraClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    cameraInputRef.current?.click();
  };

  const handleAreaClick = () => {
    // Default to file picker when clicking the area
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* Hidden file input for gallery/files - NO capture attribute */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleFileChange}
        className="hidden"
      />
      
      {/* Hidden file input for camera - WITH capture attribute */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Image preview or upload area */}
      {selectedImage ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative rounded-2xl overflow-hidden bg-muted"
        >
          {/* Receipt image preview */}
          <img
            src={selectedImage}
            alt="Receipt preview"
            className="w-full max-h-[400px] object-contain"
          />
          
          {/* Clear button */}
          <button
            onClick={onClear}
            disabled={isProcessing}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Processing overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="relative">
                  <ScanLine className="w-12 h-12 text-white animate-pulse" />
                </div>
                <p className="text-white font-medium">Analyzing receipt...</p>
              </div>
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={handleAreaClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200",
            "min-h-[280px] flex flex-col items-center justify-center gap-4 p-6",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/50"
          )}
        >
          {/* Icon */}
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center transition-colors",
            isDragging ? "bg-primary/10" : "bg-muted"
          )}>
            <Camera className={cn(
              "w-8 h-8 transition-colors",
              isDragging ? "text-primary" : "text-muted-foreground"
            )} />
          </div>

          {/* Text */}
          <div className="text-center space-y-1">
            <p className="font-semibold text-foreground">
              {isDragging ? 'Drop your receipt here' : 'Take a photo or upload'}
            </p>
            <p className="text-sm text-muted-foreground">
              JPEG, PNG, or WebP • Max 10MB
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleUploadClick}
            >
              <Upload className="w-4 h-4" />
              Upload
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleCameraClick}
            >
              <Camera className="w-4 h-4" />
              Camera
            </Button>
          </div>
        </motion.div>
      )}

      {/* Error message */}
      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-destructive text-center"
        >
          {error}
        </motion.p>
      )}

      {/* Scan button - only visible when image is selected */}
      {selectedImage && !isProcessing && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Button
            onClick={onScan}
            className="w-full h-14 text-base font-semibold gap-2 thread-gradient-teal border-0 text-white"
          >
            <ScanLine className="w-5 h-5" />
            Scan Receipt
          </Button>
        </motion.div>
      )}
    </div>
  );
}
