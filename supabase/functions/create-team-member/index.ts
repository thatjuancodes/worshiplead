import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: jsonHeaders,
    })
  }

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: jsonHeaders,
      })
    }

    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Invalid authorization header' }), {
        status: 401,
        headers: jsonHeaders,
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase configuration' }), {
        status: 500,
        headers: jsonHeaders,
      })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: authData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: jsonHeaders,
      })
    }

    const caller = authData.user
    const body = await req.json()

    const organizationId = typeof body.organizationId === 'string' ? body.organizationId.trim() : ''
    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : ''
    const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!organizationId || !firstName || !lastName || !email || !password) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: jsonHeaders,
      })
    }

    if (!emailPattern.test(email)) {
      return new Response(JSON.stringify({ error: 'Please provide a valid email address' }), {
        status: 400,
        headers: jsonHeaders,
      })
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters long' }), {
        status: 400,
        headers: jsonHeaders,
      })
    }

    const { data: membership, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', caller.id)
      .eq('status', 'active')
      .single()

    if (membershipError || !membership || !['owner', 'admin'].includes(membership.role)) {
      return new Response(JSON.stringify({ error: 'You are not authorized to create members for this organization' }), {
        status: 403,
        headers: jsonHeaders,
      })
    }

    let createdUserId: string | null = null

    try {
      const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
        },
      })

      if (createUserError || !createdUser.user) {
        if (createUserError?.message?.toLowerCase().includes('already')) {
          return new Response(JSON.stringify({
            error: 'A user with this email already exists. Add them through an invitation or use a different email address.',
          }), {
            status: 409,
            headers: jsonHeaders,
          })
        }

        console.error('Error creating auth user:', createUserError)
        return new Response(JSON.stringify({ error: 'Failed to create auth user' }), {
          status: 500,
          headers: jsonHeaders,
        })
      }

      createdUserId = createdUser.user.id

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: createdUserId,
          email,
          first_name: firstName,
          last_name: lastName,
        }, {
          onConflict: 'id',
        })

      if (profileError) {
        console.error('Error creating profile:', profileError)
        throw new Error('Failed to create profile')
      }

      const { data: existingOrgMembership, error: existingOrgMembershipError } = await supabase
        .from('organization_memberships')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('user_id', createdUserId)
        .eq('status', 'active')
        .maybeSingle()

      if (existingOrgMembershipError) {
        console.error('Error checking existing organization membership:', existingOrgMembershipError)
        throw new Error('Failed to verify membership')
      }

      if (existingOrgMembership) {
        throw new Error('This user is already a member of the organization')
      }

      const { error: createMembershipError } = await supabase
        .from('organization_memberships')
        .insert({
          organization_id: organizationId,
          user_id: createdUserId,
          role: 'member',
          status: 'active',
          invited_by: caller.id,
          accepted_at: new Date().toISOString(),
        })

      if (createMembershipError) {
        console.error('Error creating membership:', createMembershipError)
        throw new Error('Failed to add user to the organization')
      }

      return new Response(JSON.stringify({
        success: true,
        userId: createdUserId,
      }), {
        status: 200,
        headers: jsonHeaders,
      })
    } catch (error) {
      if (createdUserId) {
        const { error: cleanupError } = await supabase.auth.admin.deleteUser(createdUserId)
        if (cleanupError) {
          console.error('Error cleaning up created user:', cleanupError)
        }
      }

      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to create member',
      }), {
        status: 500,
        headers: jsonHeaders,
      })
    }
  } catch (error) {
    console.error('Error in create-team-member function:', error)
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal server error',
    }), {
      status: 500,
      headers: jsonHeaders,
    })
  }
})
