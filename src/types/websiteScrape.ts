export type WebsiteScrapePhase = 'input' | 'scraping' | 'generating' | 'preview' | 'success';

export interface WebsiteScrapeResult {
  url: string;
  title: string;
  content: string;
  memoryCount: number;
}
