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
    
    // Log the full response structure to understand field names
    console.log('Apify response type:', typeof profiles, 'isArray:', Array.isArray(profiles));
    console.log('Apify response keys:', Array.isArray(profiles) && profiles.length > 0 ? Object.keys(profiles[0]).join(', ') : 'empty');
    console.log('Apify full response (first 3000 chars):', JSON.stringify(profiles).substring(0, 3000));

    if (!Array.isArray(profiles) || profiles.length === 0) {
      throw new Error('No profile data returned from Apify');
    }

    const profile = profiles[0];
    
    // Try multiple possible field names for the name
    const name = profile.fullName 
      || profile.full_name
      || (profile.firstName || profile.first_name ? `${profile.firstName || profile.first_name || ''} ${profile.lastName || profile.last_name || ''}`.trim() : '')
      || profile.name
      || '';

    // Format structured profile data into clean text for memory generation
    const sections: string[] = [];

    if (name) sections.push(`Name: ${name}`);
    
    // Try multiple field name patterns
    const headline = profile.headline || profile.title || profile.tagline || '';
    if (headline) sections.push(`Headline: ${headline}`);
    
    const location = profile.location || profile.addressLocality || profile.geo || '';
    if (location) sections.push(`Location: ${typeof location === 'object' ? JSON.stringify(location) : location}`);
    
    const summary = profile.summary || profile.about || profile.description || '';
    if (summary) sections.push(`Summary: ${summary}`);

    // Experience - try multiple field names
    const experiences = profile.experiences || profile.experience || profile.positions || profile.workExperience || [];
    if (Array.isArray(experiences) && experiences.length > 0) {
      const expLines = experiences.map((exp: any) => {
        const title = exp.title || exp.role || exp.position || '';
        const company = exp.company || exp.companyName || exp.organization || '';
        const loc = exp.location || '';
        const parts = [title, company, loc].filter(Boolean);
        let line = parts.join(' at ');
        const duration = exp.duration || exp.dateRange || exp.dates || '';
        if (duration) line += ` (${duration})`;
        const desc = exp.description || exp.summary || '';
        if (desc) line += ` — ${desc}`;
        return `  • ${line}`;
      });
      sections.push(`Experience:\n${expLines.join('\n')}`);
    }

    // Education - try multiple field names
    const educations = profile.educations || profile.education || [];
    if (Array.isArray(educations) && educations.length > 0) {
      const eduLines = educations.map((edu: any) => {
        const degree = edu.degree || edu.degreeName || '';
        const field = edu.fieldOfStudy || edu.field || '';
        const parts = [degree, field].filter(Boolean);
        let line = edu.school || edu.schoolName || edu.institution || '';
        if (parts.length > 0) line += ` — ${parts.join(', ')}`;
        const duration = edu.duration || edu.dateRange || edu.dates || '';
        if (duration) line += ` (${duration})`;
        return `  • ${line}`;
      });
      sections.push(`Education:\n${eduLines.join('\n')}`);
    }

    // Skills
    const skills = profile.skills || [];
    if (Array.isArray(skills) && skills.length > 0) {
      const skillNames = skills.map((s: any) => typeof s === 'string' ? s : s.name || s.skill || s.title || '').filter(Boolean);
      if (skillNames.length > 0) {
        sections.push(`Skills: ${skillNames.join(', ')}`);
      }
    }

    // Languages
    const languages = profile.languages || [];
    if (Array.isArray(languages) && languages.length > 0) {
      const langNames = languages.map((l: any) => typeof l === 'string' ? l : l.name || l.language || '').filter(Boolean);
      if (langNames.length > 0) {
        sections.push(`Languages: ${langNames.join(', ')}`);
      }
    }

    // Certifications
    const certifications = profile.certifications || [];
    if (Array.isArray(certifications) && certifications.length > 0) {
      const certLines = certifications.map((c: any) => {
        return `  • ${c.name || c.title || ''}${c.authority ? ` (${c.authority})` : ''}`;
      });
      sections.push(`Certifications:\n${certLines.join('\n')}`);
    }

    // Volunteer
    const volunteer = profile.volunteer || profile.volunteerExperiences || [];
    if (Array.isArray(volunteer) && volunteer.length > 0) {
      const volLines = volunteer.map((v: any) => {
        return `  • ${v.role || v.title || ''} at ${v.organization || v.company || ''}`;
      });
      sections.push(`Volunteer:\n${volLines.join('\n')}`);
    }

    const content = sections.join('\n\n');

    // If structured parsing found nothing, try dumping all string values from the profile
    if (!content.trim()) {
      console.log('Structured parsing found nothing, attempting raw extraction...');
      const rawParts: string[] = [];
      for (const [key, value] of Object.entries(profile)) {
        if (typeof value === 'string' && value.trim().length > 0) {
          rawParts.push(`${key}: ${value}`);
        } else if (Array.isArray(value) && value.length > 0) {
          rawParts.push(`${key}: ${JSON.stringify(value)}`);
        }
      }
      if (rawParts.length > 0) {
        const rawContent = rawParts.join('\n\n');
        console.log(`Raw extraction found ${rawParts.length} fields, content length: ${rawContent.length}`);
        return new Response(
          JSON.stringify({ success: true, content: rawContent, name: name || 'LinkedIn Profile' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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
