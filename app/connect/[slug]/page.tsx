import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import ConnectClient from '@/app/connect/[slug]/ConnectClient'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name')
    .eq('connect_slug', slug)
    .single();

  if (!profile) {
    return {
      title: 'Invite not found | common',
      description: 'This friendship link may have expired or is no longer valid.',
    };
  }

  const description = `${profile.first_name} wants to make more memories with you. Become friends on common to see what they're up to and get involved.`;

  return {
    title: `${profile.first_name} invited you | common`,
    description,
    openGraph: {
      title: `${profile.first_name} wants to make more memories with you`,
      description,
      siteName: 'common',
      type: 'website',
      locale: 'en_GB',
    },
    twitter: {
      card: 'summary',
      title: `${profile.first_name} invited you | common`,
      description,
    },
  };
}

export default async function ConnectPage({ params }: Props) {
  const { slug } = await params;
  return <ConnectClient slug={slug} />;
}