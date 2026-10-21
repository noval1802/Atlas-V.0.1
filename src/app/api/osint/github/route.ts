import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get('user');

  if (!username) return NextResponse.json({ error: 'Missing username parameter' }, { status: 400 });

  try {
    const [userRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'OSIRIS-Recon' } }),
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=5`, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'OSIRIS-Recon' } })
    ]);

    if (userRes.status === 404) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (!userRes.ok) throw new Error(`GitHub API HTTP ${userRes.status}`);

    const userData = await userRes.json() as {
      login?: string;
      name?: string | null;
      company?: string | null;
      blog?: string | null;
      location?: string | null;
      email?: string | null;
      bio?: string | null;
      twitter_username?: string | null;
      public_repos?: number;
      followers?: number;
      created_at?: string;
      avatar_url?: string;
    };
    const reposData: unknown = reposRes.ok ? await reposRes.json() : [];

    return NextResponse.json({
      username: userData.login,
      name: userData.name,
      company: userData.company,
      blog: userData.blog,
      location: userData.location,
      email: userData.email,
      bio: userData.bio,
      twitter: userData.twitter_username,
      public_repos: userData.public_repos,
      followers: userData.followers,
      created_at: userData.created_at,
      avatar_url: userData.avatar_url,
      recent_repos: Array.isArray(reposData) ? reposData.map((r: { name?: string; language?: string | null; updated_at?: string }) => ({ name: r.name, language: r.language, updated: r.updated_at })) : []
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'GitHub lookup failed', detail: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
