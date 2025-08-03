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

    const { email, organizationName, invitedBy, organizationId, inviteId } = await req.json()

    // Verify user is a member of the organization they're inviting to
    const { data: membership, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .single()

    if (membershipError || !membership) {
      console.error('Membership verification error:', membershipError)
      return new Response(
        JSON.stringify({ error: 'You are not authorized to invite users to this organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Sending invitation to:', { email, organizationName, invitedBy, organizationId, inviteId })

    // Use a custom email template approach that doesn't create auth records
    // We'll use the built-in email service but with a custom template
    const inviteUrl = `${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/signup?invite=${inviteId}`
    
    // For now, we'll use a simple approach that doesn't create auth records
    // In production, you might want to use a service like SendGrid, Mailgun, etc.
    const emailData = {
      to: email,
      subject: `You've been invited to join ${organizationName} on WorshipLead`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>You've been invited!</h2>
          <p>${invitedBy} has invited you to join <strong>${organizationName}</strong> on WorshipLead.</p>
          <p>WorshipLead helps churches organize worship teams with ease. Schedule volunteers, plan setlists, and manage your song library — all in one simple, powerful tool.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          <p style="font-size: 14px; color: #6b7280;">
            This invitation will expire in 7 days. If you have any questions, please contact your team administrator.
          </p>
        </div>
      `
    }

    // For now, just return success - in production you'd send the actual email
    // You could integrate with SendGrid, Mailgun, or other email services here
    console.log('Email data for sending:', emailData)
    
    const data = {
      message: 'Invitation email prepared successfully',
      inviteUrl: inviteUrl
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in send-invitation function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}) 