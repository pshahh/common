import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Decode the JWT to get the user ID (the signature was already verified by Supabase when issued)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const userId = payload.sub;
    const role = payload.role;
    const exp = payload.exp;
    
    console.log('User ID from token:', userId);
    console.log('Role:', role);
    console.log('Expired:', exp * 1000 < Date.now());
    
    if (!userId || role !== 'authenticated' || exp * 1000 < Date.now()) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Use admin client for all operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify user actually exists
    const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    console.log('getUserById result - user:', !!user, 'error:', userError?.message);
    
    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    // 1. Fetch all thread info in parallel
    const [{ data: createdThreads }, { data: participatingThreads }, { data: profile }] = await Promise.all([
      supabaseAdmin.from('threads').select('id').eq('created_by', userId),
      supabaseAdmin.from('threads').select('id, participant_ids').contains('participant_ids', [userId]),
      supabaseAdmin.from('profiles').select('avatar_url').eq('id', userId).single(),
    ]);

    // 2. Delete data from threads the user created
    if (createdThreads && createdThreads.length > 0) {
      const threadIds = createdThreads.map(t => t.id);
      await Promise.all([
        supabaseAdmin.from('thread_reads').delete().in('thread_id', threadIds),
        supabaseAdmin.from('messages').delete().in('thread_id', threadIds),
      ]);
      await supabaseAdmin.from('threads').delete().in('id', threadIds);
    }

    // 3. Remove user from remaining threads
    if (participatingThreads) {
      const createdIds = new Set(createdThreads?.map(t => t.id) || []);
      const remaining = participatingThreads.filter(t => !createdIds.has(t.id));
      await Promise.all(remaining.map(thread => {
        const updatedIds = thread.participant_ids.filter((id: string) => id !== userId);
        if (updatedIds.length === 0) {
          return supabaseAdmin.from('threads').delete().eq('id', thread.id);
        }
        return supabaseAdmin.from('threads').update({ participant_ids: updatedIds }).eq('id', thread.id);
      }));
    }

    // 4. Delete everything else in parallel
    await Promise.all([
      supabaseAdmin.from('thread_reads').delete().eq('user_id', userId),
      supabaseAdmin.from('messages').delete().eq('sender_id', userId),
      supabaseAdmin.from('reports').delete().eq('reported_by', userId),
      supabaseAdmin.from('blocked_users').delete().or(`user_id.eq.${userId},blocked_user_id.eq.${userId}`),
      supabaseAdmin.from('posts').delete().eq('user_id', userId),
      profile?.avatar_url
        ? supabaseAdmin.storage.from('avatars').remove([profile.avatar_url.split('/avatars/')[1]])
        : Promise.resolve(),
    ]);

    // 5. Delete profile then auth user
    await supabaseAdmin.from('profiles').delete().eq('id', userId);
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError);
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete account error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}