import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response('ok', { 
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Max-Age": "86400"
      }
    })
  }

  console.log('Edge Function called with method:', req.method)

  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: 'No authorization header'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    // Extract the JWT token
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({
        error: 'Invalid authorization header'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the JWT token and get user info
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(JSON.stringify({
        error: 'Invalid or expired token'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    const { email, organizationName, invitedBy, organizationId, inviteId } = await req.json();
    
    console.log('Debug info:', {
      userId: user.id,
      organizationId,
      email,
      organizationName,
      invitedBy
    });

    // Verify user is a member of the organization they're inviting to
    const { data: membership, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .single();

    if (membershipError || !membership) {
      console.error('Membership verification error:', membershipError);
      return new Response(JSON.stringify({
        error: 'You are not authorized to invite users to this organization'
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    console.log('Preparing invitation email for:', {
      email,
      organizationName,
      invitedBy,
      organizationId,
      inviteId
    });

    // Instead of creating an auth record, just prepare the email data
    // The actual email sending should be handled by your email service
    const inviteUrl = `${supabaseUrl.replace('/rest/v1', '')}/auth/v1/verify?token=${inviteId}&type=signup&next=/dashboard`;
    
    const emailData = {
      to: email,
      subject: `You've been invited to join ${organizationName} on Worship Lead`,
      template: 'invitation',
      templateData: {
        InvitedBy: invitedBy,
        OrganizationName: organizationName,
        Year: new Date().getFullYear().toString(),
        ConfirmationURL: inviteUrl,
        organization_id: organizationId,
        invite_id: inviteId
      }
    };

    console.log('Email data prepared:', emailData);
    console.log('Note: This function only prepares the email data. You need to integrate with your email service to actually send the email.');

    // Return success - the actual email sending should be handled by your email service
    return new Response(JSON.stringify({
      success: true,
      message: 'Invitation prepared successfully',
      emailData: emailData,
      note: 'Email data prepared. Integrate with your email service to send the actual email.'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Max-Age': '86400'
      }
    });

  } catch (error) {
    console.error('Error in send-invitation function:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Max-Age': '86400'
      }
    });
  }
}); 