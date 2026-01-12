import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

/**
 * Receipt data structure returned from OCR processing
 */
export interface ReceiptData {
  storeName: string | null;
  date: string | null;
  items: Array<{ name: string; price: number }>;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  paymentMethod: string | null;
  confidence: 'high' | 'medium' | 'low';
  memoryString: string;
  userName: string;
}

interface UseReceiptUploadReturn {
  processReceipt: (imageBase64: string) => Promise<ReceiptData | null>;
  uploadToStorage: (file: File, userId: string) => Promise<string | null>;
  isProcessing: boolean;
  isUploading: boolean;
  error: string | null;
}

// Accepted image formats
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function useReceiptUpload(): UseReceiptUploadReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Validate a file before processing
   */
  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type.toLowerCase())) {
      return 'Please upload a JPEG, PNG, or WebP image.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'Image is too large. Maximum size is 10MB.';
    }
    return null;
  };

  /**
   * Convert a file to base64 string
   */
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  /**
   * Process a receipt image using the edge function OCR
   */
  const processReceipt = async (imageBase64: string): Promise<ReceiptData | null> => {
    setIsProcessing(true);
    setError(null);

    try {
      console.log('Calling process-receipt function...');
      
      const { data, error: fnError } = await supabase.functions.invoke('process-receipt', {
        body: { imageBase64 },
      });

      if (fnError) {
        console.error('Process receipt error:', fnError);
        const errorMessage = fnError.message || 'Failed to process receipt';
        
        // Handle specific error cases
        if (errorMessage.includes('Rate limit')) {
          toast({
            title: 'Rate limit exceeded',
            description: 'Please wait a moment and try again.',
            variant: 'destructive',
          });
        } else if (errorMessage.includes('credits')) {
          toast({
            title: 'AI credits exhausted',
            description: 'Please add credits to continue using AI features.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Failed to process receipt',
            description: errorMessage,
            variant: 'destructive',
          });
        }
        
        setError(errorMessage);
        return null;
      }

      if (!data?.success || !data?.data) {
        console.error('Invalid response from process-receipt:', data);
        setError('Invalid response from receipt processing');
        toast({
          title: 'Processing failed',
          description: 'Could not extract data from the receipt image.',
          variant: 'destructive',
        });
        return null;
      }

      console.log('Receipt processed successfully:', data.data);
      return data.data as ReceiptData;

    } catch (err) {
      console.error('Unexpected error processing receipt:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      toast({
        title: 'Processing failed',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Upload receipt image to Supabase storage for backup/reference
   */
  const uploadToStorage = async (file: File, userId: string): Promise<string | null> => {
    setIsUploading(true);
    setError(null);

    try {
      // Validate file
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        toast({
          title: 'Invalid file',
          description: validationError,
          variant: 'destructive',
        });
        return null;
      }

      // Generate unique filename
      const timestamp = Date.now();
      const extension = file.name.split('.').pop() || 'jpg';
      const fileName = `${userId}/${timestamp}.${extension}`;

      console.log('Uploading receipt to storage:', fileName);

      const { data, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        setError(uploadError.message);
        toast({
          title: 'Upload failed',
          description: uploadError.message,
          variant: 'destructive',
        });
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(data.path);

      console.log('Receipt uploaded successfully:', urlData.publicUrl);
      return urlData.publicUrl;

    } catch (err) {
      console.error('Unexpected error uploading receipt:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    processReceipt,
    uploadToStorage,
    isProcessing,
    isUploading,
    error,
  };
}

// Re-export validation helpers for use in components
export { ACCEPTED_TYPES, MAX_FILE_SIZE };

/**
 * Convert file to base64
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
