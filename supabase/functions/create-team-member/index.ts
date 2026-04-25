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

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildCredentialsEmail({
  createdNewUser,
  email,
  password,
  firstName,
  organizationName,
  loginUrl,
}: {
  createdNewUser: boolean
  email: string
  password: string
  firstName: string
  organizationName: string
  loginUrl: string
}) {
  const safeFirstName = escapeHtml(firstName || 'there')
  const safeOrganizationName = escapeHtml(organizationName)
  const safeLoginUrl = escapeHtml(loginUrl)
  const safeEmail = escapeHtml(email)
  const safePassword = escapeHtml(password)

  if (createdNewUser) {
    return {
      subject: `Your Spirit Lead account for ${organizationName}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
          <p>Hello ${safeFirstName},</p>
          <p>Your Spirit Lead account for <strong>${safeOrganizationName}</strong> has been created.</p>
          <p>Use these credentials to sign in:</p>
          <ul>
            <li><strong>Email:</strong> ${safeEmail}</li>
            <li><strong>Temporary password:</strong> ${safePassword}</li>
          </ul>
          <p>
            <a href="${safeLoginUrl}" style="display: inline-block; padding: 12px 18px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px;">
              Log in to Spirit Lead
            </a>
          </p>
          <p>After signing in, you should change your password.</p>
        </div>
      `,
      text: `Hello ${firstName || 'there'},

Your Spirit Lead account for ${organizationName} has been created.

Email: ${email}
Temporary password: ${password}

Log in here: ${loginUrl}

After signing in, you should change your password.`,
    }
  }

  return {
    subject: `You've been added to ${organizationName} on Spirit Lead`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        <p>Hello ${safeFirstName},</p>
        <p>You were added to <strong>${safeOrganizationName}</strong> on Spirit Lead.</p>
        <p>Your account already existed, and your sign-in password has been updated by an administrator.</p>
        <ul>
          <li><strong>Email:</strong> ${safeEmail}</li>
          <li><strong>Temporary password:</strong> ${safePassword}</li>
        </ul>
        <p>
          <a href="${safeLoginUrl}" style="display: inline-block; padding: 12px 18px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px;">
            Log in to Spirit Lead
          </a>
        </p>
        <p>After signing in, you should change your password.</p>
      </div>
    `,
    text: `Hello ${firstName || 'there'},

You were added to ${organizationName} on Spirit Lead.

Your account already existed, and your sign-in password has been updated by an administrator.

Email: ${email}
Temporary password: ${password}

Log in here: ${loginUrl}

After signing in, you should change your password.`,
  }
}

async function sendCredentialsEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string
  subject: string
  html: string
  text: string
}) {
  const sendGridApiKey = Deno.env.get('SENDGRID_API_KEY')
  const sendGridFromEmail = Deno.env.get('SENDGRID_FROM_EMAIL')
  const sendGridFromName = Deno.env.get('SENDGRID_FROM_NAME')
  const sendGridReplyTo = Deno.env.get('SENDGRID_REPLY_TO')

  if (!sendGridApiKey || !sendGridFromEmail) {
    return {
      sent: false,
      error: 'Missing SENDGRID_API_KEY or SENDGRID_FROM_EMAIL secret',
    }
  }

  const payload: Record<string, unknown> = {
    personalizations: [
      {
        to: [{ email: to }],
        subject,
      },
    ],
    from: sendGridFromName
      ? {
          email: sendGridFromEmail,
          name: sendGridFromName,
        }
      : {
          email: sendGridFromEmail,
        },
    content: [
      {
        type: 'text/plain',
        value: text,
      },
      {
        type: 'text/html',
        value: html,
      },
    ],
  }

  if (sendGridReplyTo) {
    payload.reply_to = {
      email: sendGridReplyTo,
    }
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sendGridApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (response.status !== 202) {
    const errorText = await response.text()
    return {
      sent: false,
      error: `SendGrid send failed: ${response.status} ${errorText}`,
    }
  }

  return {
    sent: true,
    error: null,
  }
}

async function findAuthUserByEmail(supabase: ReturnType<typeof createClient>, email: string) {
  let page = 1
  const perPage = 200

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    })

    if (error) {
      throw error
    }

    const users = data?.users ?? []
    const matchedUser = users.find(user => user.email?.toLowerCase() === email)

    if (matchedUser) {
      return matchedUser
    }

    if (users.length < perPage) {
      return null
    }

    page += 1
  }
}

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
    const organizationName = typeof body.organizationName === 'string' && body.organizationName.trim()
      ? body.organizationName.trim()
      : 'your organization'
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

    let targetUserId: string | null = null
    let createdNewUser = false

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
          const existingAuthUser = await findAuthUserByEmail(supabase, email)

          if (!existingAuthUser) {
            return new Response(JSON.stringify({
              error: 'A user with this email already exists, but no matching auth record could be loaded.',
            }), {
              status: 409,
              headers: jsonHeaders,
            })
          }

          targetUserId = existingAuthUser.id

          const { error: updateExistingUserError } = await supabase.auth.admin.updateUserById(
            targetUserId,
            {
              password,
              email_confirm: true,
              user_metadata: {
                ...(existingAuthUser.user_metadata || {}),
                first_name: firstName,
                last_name: lastName,
              },
            }
          )

          if (updateExistingUserError) {
            console.error('Error updating existing auth user:', updateExistingUserError)
            return new Response(JSON.stringify({ error: 'Failed to update existing auth user' }), {
              status: 500,
              headers: jsonHeaders,
            })
          }
        } else {
          console.error('Error creating auth user:', createUserError)
          return new Response(JSON.stringify({ error: 'Failed to create auth user' }), {
            status: 500,
            headers: jsonHeaders,
          })
        }
      } else {
        targetUserId = createdUser.user.id
        createdNewUser = true
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: targetUserId,
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
        .eq('user_id', targetUserId)
        .eq('status', 'active')
        .maybeSingle()

      if (existingOrgMembershipError) {
        console.error('Error checking existing organization membership:', existingOrgMembershipError)
        throw new Error('Failed to verify membership')
      }

      if (existingOrgMembership) {
        return new Response(JSON.stringify({
          error: 'This user is already a member of the organization',
        }), {
          status: 409,
          headers: jsonHeaders,
        })
      }

      const { error: createMembershipError } = await supabase
        .from('organization_memberships')
        .insert({
          organization_id: organizationId,
          user_id: targetUserId,
          role: 'member',
          status: 'active',
          invited_by: caller.id,
          accepted_at: new Date().toISOString(),
        })

      if (createMembershipError) {
        console.error('Error creating membership:', createMembershipError)
        throw new Error('Failed to add user to the organization')
      }

      const siteUrl = (Deno.env.get('SITE_URL') || 'https://spiritlead.church').replace(/\/$/, '')
      const loginUrl = `${siteUrl}/login`
      const emailContent = buildCredentialsEmail({
        createdNewUser,
        email,
        password,
        firstName,
        organizationName,
        loginUrl,
      })
      const emailResult = await sendCredentialsEmail({
        to: email,
        ...emailContent,
      })

      return new Response(JSON.stringify({
        success: true,
        userId: targetUserId,
        createdNewUser,
        emailSent: emailResult.sent,
        emailError: emailResult.error,
      }), {
        status: 200,
        headers: jsonHeaders,
      })
    } catch (error) {
      if (createdNewUser && targetUserId) {
        const { error: cleanupError } = await supabase.auth.admin.deleteUser(targetUserId)
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
