import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get the user's JWT from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create a client with the user's JWT to verify identity
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

    // Create admin client to delete data and auth user
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const userId = user.id

    // Delete in order: child tables first
    await supabaseAdmin.from('thread_reads').delete().eq('user_id', userId)
    await supabaseAdmin.from('messages').delete().eq('sender_id', userId)
    await supabaseAdmin.from('reports').delete().eq('reported_by', userId)
    await supabaseAdmin.from('blocked_users').delete().or(`user_id.eq.${userId},blocked_user_id.eq.${userId}`)
    await supabaseAdmin.from('posts').delete().eq('user_id', userId)

    // Remove user from any thread participant_ids
    // Delete threads created by this user (and their messages/reads first)
const { data: createdThreads } = await supabaseAdmin
.from('threads')
.select('id')
.eq('created_by', userId)

if (createdThreads) {
const threadIds = createdThreads.map(t => t.id)
if (threadIds.length > 0) {
  await supabaseAdmin.from('thread_reads').delete().in('thread_id', threadIds)
  await supabaseAdmin.from('messages').delete().in('thread_id', threadIds)
  await supabaseAdmin.from('threads').delete().in('id', threadIds)
}
}

// Remove user from any remaining thread participant_ids
const { data: threads } = await supabaseAdmin
.from('threads')
.select('id, participant_ids')
.contains('participant_ids', [userId])

if (threads) {
for (const thread of threads) {
  const updatedIds = thread.participant_ids.filter((id: string) => id !== userId)
  if (updatedIds.length === 0) {
    await supabaseAdmin.from('threads').delete().eq('id', thread.id)
  } else {
    await supabaseAdmin.from('threads').update({ participant_ids: updatedIds }).eq('id', thread.id)
  }
}
}

    // Delete avatar from storage
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single()

    if (profile?.avatar_url) {
      const avatarPath = profile.avatar_url.split('/avatars/')[1]
      if (avatarPath) {
        await supabaseAdmin.storage.from('avatars').remove([avatarPath])
      }
    }

    // Delete profile
    await supabaseAdmin.from('profiles').delete().eq('id', userId)

    // Delete the auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
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