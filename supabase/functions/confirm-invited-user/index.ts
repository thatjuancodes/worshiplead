import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  console.log('Edge Function called with method:', req.method)

  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Extract the JWT token
    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the JWT token and get user info
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      console.error('Authentication error:', authError)
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { inviteId } = await req.json()

    console.log('Processing invitation:', { inviteId, userEmail: user.email, userId: user.id })

    // Verify the invitation exists and is valid
    const { data: invitation, error: inviteError } = await supabase
      .from('organization_invites')
      .select('*')
      .eq('id', inviteId)
      .eq('status', 'pending')
      .single()

    if (inviteError) {
      console.error('Invitation verification error:', inviteError)
      return new Response(
        JSON.stringify({ error: 'Invalid or expired invitation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!invitation) {
      console.error('No invitation found for ID:', inviteId)
      return new Response(
        JSON.stringify({ error: 'Invitation not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Found invitation:', invitation)

    // Check if invitation email matches user email
    if (invitation.email !== user.email) {
      console.error('Email mismatch:', { invitationEmail: invitation.email, userEmail: user.email })
      return new Response(
        JSON.stringify({ error: 'Email mismatch with invitation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if invitation has expired
    const now = new Date()
    const expiresAt = new Date(invitation.expires_at)
    if (now > expiresAt) {
      return new Response(
        JSON.stringify({ error: 'Invitation has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Confirm the user's email
    console.log('Confirming email for user:', user.id)
    
    const { error: confirmError } = await supabase.auth.admin.updateUserById(
      user.id,
      { 
        email_confirm: true,
        email_confirmed_at: new Date().toISOString()
      }
    )

    if (confirmError) {
      console.error('Error confirming email:', confirmError)
      return new Response(
        JSON.stringify({ error: 'Failed to confirm email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Email confirmed successfully')

    // Check if user is already a member
    const { data: existingMembership, error: checkError } = await supabase
      .from('organization_memberships')
      .select('id')
      .eq('organization_id', invitation.organization_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (checkError) {
      console.error('Error checking existing membership:', checkError)
      // Continue anyway - this is not critical
    }

    if (existingMembership) {
      console.log('User is already a member of this organization')
    } else {
      // Add user to organization
      console.log('Adding user to organization:', { organizationId: invitation.organization_id, userId: user.id })
      
      const { error: membershipError } = await supabase
        .from('organization_memberships')
        .insert({
          organization_id: invitation.organization_id,
          user_id: user.id,
          role: 'member',
          status: 'active',
          invited_by: invitation.invited_by,
          accepted_at: new Date().toISOString()
        })

      if (membershipError) {
        console.error('Error creating membership:', membershipError)
        return new Response(
          JSON.stringify({ error: 'Failed to add user to organization' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      console.log('Successfully added user to organization')
    }

    // Update invitation status
    const { error: updateError } = await supabase
      .from('organization_invites')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', inviteId)

    if (updateError) {
      console.error('Error updating invitation:', updateError)
      // Don't fail the whole process for this
    }

    console.log('Invitation process completed successfully')
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email confirmed and user added to organization successfully' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in confirm-invited-user function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}) 