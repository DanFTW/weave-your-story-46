export type LinkedInProfileScrapePhase = 'input' | 'scraping' | 'generating' | 'preview' | 'success';

export interface LinkedInProfileScrapeResult {
  url: string;
  name: string;
  memoryCount: number;
}
