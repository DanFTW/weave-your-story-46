-- Create receipts storage bucket for receipt images
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for receipts storage bucket

-- Policy: Users can upload to their own folder
CREATE POLICY "Users can upload receipts to own folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'receipts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can view their own receipts
CREATE POLICY "Users can view own receipts"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'receipts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own receipts
CREATE POLICY "Users can delete own receipts"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'receipts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Public read access for displaying receipt images
CREATE POLICY "Public read access for receipts"
ON storage.objects
FOR SELECT
USING (bucket_id = 'receipts');