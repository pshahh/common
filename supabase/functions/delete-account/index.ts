import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const userId = user.id
    console.log('Starting deletion for user:', userId)

    // 1. Find all threads to clean up (parallel fetch)
    const [{ data: createdThreads }, { data: participatingThreads }, { data: profile }] = await Promise.all([
      supabaseAdmin.from('threads').select('id').eq('created_by', userId),
      supabaseAdmin.from('threads').select('id, participant_ids').contains('participant_ids', [userId]),
      supabaseAdmin.from('profiles').select('avatar_url').eq('id', userId).single(),
    ])
    console.log('Step 1: threads fetched')
    // 2. Delete data from threads the user created
    if (createdThreads && createdThreads.length > 0) {
      const threadIds = createdThreads.map(t => t.id)
      await Promise.all([
        supabaseAdmin.from('thread_reads').delete().in('thread_id', threadIds),
        supabaseAdmin.from('messages').delete().in('thread_id', threadIds),
      ])
      await supabaseAdmin.from('threads').delete().in('id', threadIds)
    }
    console.log('Step 2: threads deleted')
    // 3. Remove user from remaining threads
    if (participatingThreads) {
      const createdIds = new Set(createdThreads?.map(t => t.id) || [])
      const remaining = participatingThreads.filter(t => !createdIds.has(t.id))
      await Promise.all(remaining.map(thread => {
        const updatedIds = thread.participant_ids.filter((id: string) => id !== userId)
        if (updatedIds.length === 0) {
          return supabaseAdmin.from('threads').delete().eq('id', thread.id)
        }
        return supabaseAdmin.from('threads').update({ participant_ids: updatedIds }).eq('id', thread.id)
      }))
    }
    console.log('Step 3: participating threads cleaned')
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
    ])
    console.log('Step 4: remaining data deleted')
    // 5. Delete profile then auth user (sequential — profile must go first)
    await supabaseAdmin.from('profiles').delete().eq('id', userId)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    console.log('Step 5: profile deleted, deleting auth user')
    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError)
      return new Response(JSON.stringify({ error: 'Failed to delete account' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Delete account error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})