import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if (!FIRECRAWL_API_KEY) {
      throw new Error('FIRECRAWL_API_KEY is not configured');
    }

    const { url } = await req.json();
    if (!url || !url.includes('linkedin.com/in/')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Please provide a valid LinkedIn profile URL (linkedin.com/in/...)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scraping LinkedIn profile via Firecrawl:', url);

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl API error:', JSON.stringify(data));
      throw new Error(data.error || `Firecrawl request failed [${response.status}]`);
    }

    const markdown = data.data?.markdown || data.markdown || '';
    const metadata = data.data?.metadata || data.metadata || {};

    if (!markdown || markdown.trim().length < 50) {
      throw new Error('Could not extract meaningful content from this LinkedIn profile. The profile may be private or require authentication.');
    }

    // Extract name from metadata title or from the markdown content
    let name = '';
    if (metadata.title) {
      // LinkedIn titles are typically "FirstName LastName - Title | LinkedIn"
      const titleMatch = metadata.title.match(/^([^-|]+)/);
      if (titleMatch) {
        name = titleMatch[1].trim();
      }
    }
    if (!name) {
      // Try to extract from first heading in markdown
      const headingMatch = markdown.match(/^#\s+(.+)$/m);
      if (headingMatch) {
        name = headingMatch[1].trim();
      }
    }

    console.log(`Successfully scraped profile for: ${name || 'Unknown'}, content length: ${markdown.length}`);

    return new Response(
      JSON.stringify({ success: true, content: markdown, name: name || 'LinkedIn Profile' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('LinkedIn profile scrape error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
