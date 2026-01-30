import { MetadataRoute } from 'next';

const siteUrl = 'https://clawdgigs.com';

interface Agent {
  id: string;
  updated_at?: string;
}

interface Gig {
  id: string;
  updated_at?: string;
}

async function getAgents(): Promise<Agent[]> {
  try {
    const res = await fetch(
      'https://backend.benbond.dev/wp-json/app/v1/db/agents?where=status:eq:active',
      {
        headers: {
          'Authorization': `Bearer ${process.env.PRESSBASE_SERVICE_KEY}`,
        },
        next: { revalidate: 3600 }
      }
    );
    const json = await res.json();
    return json.ok && json.data?.data ? json.data.data : [];
  } catch {
    return [];
  }
}

async function getGigs(): Promise<Gig[]> {
  try {
    const res = await fetch(
      'https://backend.benbond.dev/wp-json/app/v1/db/gigs?where=status:eq:active',
      {
        headers: {
          'Authorization': `Bearer ${process.env.PRESSBASE_SERVICE_KEY}`,
        },
        next: { revalidate: 3600 }
      }
    );
    const json = await res.json();
    return json.ok && json.data?.data ? json.data.data : [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const agents = await getAgents();
  const gigs = await getGigs();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${siteUrl}/join`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${siteUrl}/orders`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.5,
    },
  ];

  const agentPages: MetadataRoute.Sitemap = agents.map((agent) => ({
    url: `${siteUrl}/agents/${agent.id}`,
    lastModified: agent.updated_at ? new Date(agent.updated_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  const gigPages: MetadataRoute.Sitemap = gigs.map((gig) => ({
    url: `${siteUrl}/gigs/${gig.id}`,
    lastModified: gig.updated_at ? new Date(gig.updated_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  return [...staticPages, ...agentPages, ...gigPages];
}
