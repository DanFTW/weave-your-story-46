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
    const APIFY_TOKEN = Deno.env.get('APIFY_TOKEN');
    if (!APIFY_TOKEN) {
      throw new Error('APIFY_TOKEN is not configured');
    }

    const { url } = await req.json();
    if (!url || !url.includes('linkedin.com/in/')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Please provide a valid LinkedIn profile URL (linkedin.com/in/...)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scraping LinkedIn profile:', url);

    const apifyResponse = await fetch(
      `https://api.apify.com/v2/acts/dev_fusion~linkedin-profile-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileUrls: [url],
        }),
      }
    );

    if (!apifyResponse.ok) {
      const errorBody = await apifyResponse.text();
      console.error(`Apify API error [${apifyResponse.status}]:`, errorBody);
      throw new Error(`Apify API call failed [${apifyResponse.status}]: ${errorBody}`);
    }

    const profiles = await apifyResponse.json();
    if (!Array.isArray(profiles) || profiles.length === 0) {
      throw new Error('No profile data returned from Apify');
    }

    const profile = profiles[0];
    const name = profile.fullName || profile.firstName && profile.lastName
      ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim()
      : '';

    // Format structured profile data into clean text for memory generation
    const sections: string[] = [];

    if (name) sections.push(`Name: ${name}`);
    if (profile.headline) sections.push(`Headline: ${profile.headline}`);
    if (profile.location) sections.push(`Location: ${profile.location}`);
    if (profile.summary) sections.push(`Summary: ${profile.summary}`);

    // Experience
    if (profile.experiences && Array.isArray(profile.experiences) && profile.experiences.length > 0) {
      const expLines = profile.experiences.map((exp: any) => {
        const parts = [exp.title, exp.company, exp.location].filter(Boolean);
        let line = parts.join(' at ');
        if (exp.duration) line += ` (${exp.duration})`;
        if (exp.description) line += ` — ${exp.description}`;
        return `  • ${line}`;
      });
      sections.push(`Experience:\n${expLines.join('\n')}`);
    }

    // Education
    if (profile.educations && Array.isArray(profile.educations) && profile.educations.length > 0) {
      const eduLines = profile.educations.map((edu: any) => {
        const parts = [edu.degree, edu.fieldOfStudy].filter(Boolean);
        let line = edu.school || '';
        if (parts.length > 0) line += ` — ${parts.join(', ')}`;
        if (edu.duration) line += ` (${edu.duration})`;
        return `  • ${line}`;
      });
      sections.push(`Education:\n${eduLines.join('\n')}`);
    }

    // Skills
    if (profile.skills && Array.isArray(profile.skills) && profile.skills.length > 0) {
      const skillNames = profile.skills.map((s: any) => typeof s === 'string' ? s : s.name || s.skill).filter(Boolean);
      if (skillNames.length > 0) {
        sections.push(`Skills: ${skillNames.join(', ')}`);
      }
    }

    // Languages
    if (profile.languages && Array.isArray(profile.languages) && profile.languages.length > 0) {
      const langNames = profile.languages.map((l: any) => typeof l === 'string' ? l : l.name || l.language).filter(Boolean);
      if (langNames.length > 0) {
        sections.push(`Languages: ${langNames.join(', ')}`);
      }
    }

    // Certifications
    if (profile.certifications && Array.isArray(profile.certifications) && profile.certifications.length > 0) {
      const certLines = profile.certifications.map((c: any) => {
        return `  • ${c.name || c.title}${c.authority ? ` (${c.authority})` : ''}`;
      });
      sections.push(`Certifications:\n${certLines.join('\n')}`);
    }

    // Volunteer
    if (profile.volunteer && Array.isArray(profile.volunteer) && profile.volunteer.length > 0) {
      const volLines = profile.volunteer.map((v: any) => {
        return `  • ${v.role || v.title} at ${v.organization || v.company}`;
      });
      sections.push(`Volunteer:\n${volLines.join('\n')}`);
    }

    const content = sections.join('\n\n');

    if (!content.trim()) {
      throw new Error('Profile returned but contained no extractable data');
    }

    console.log(`Successfully scraped profile for: ${name}, content length: ${content.length}`);

    return new Response(
      JSON.stringify({ success: true, content, name }),
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
