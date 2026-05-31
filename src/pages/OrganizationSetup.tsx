import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createOrganizationAndMembership, checkSlugAvailability, getUserPrimaryOrganization } from '../lib/auth'
import type { OrganizationData } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { EntryShell } from '../components/EntryShell'

export function OrganizationSetup() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [joinRequestSubmitted, setJoinRequestSubmitted] = useState(false)
  const [orgForm, setOrgForm] = useState({
    name: '',
    slug: '',
  })
  const [joinForm, setJoinForm] = useState({
    organizationSlug: '',
  })
  const [existingRequest, setExistingRequest] = useState<{
    organizationName: string
    organizationSlug: string
  } | null>(null)
  const [submittedRequestOrg, setSubmittedRequestOrg] = useState<{
    organizationName: string
    organizationSlug: string
  } | null>(null)

  useEffect(() => {
    const checkExistingOrganization = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          return
        }

        const userOrg = await getUserPrimaryOrganization(user.id)
        if (userOrg) {
          navigate('/dashboard', {
            state: { message: 'Welcome back! Redirected to your dashboard.' },
          })
        }
      } catch (existingOrgError) {
        console.error('Error checking existing organization:', existingOrgError)
      }
    }

    checkExistingOrganization()
  }, [navigate])

  const handleOrganizationSlugChange = (slug: string) => {
    setJoinForm((prev) => ({ ...prev, organizationSlug: slug }))
    if (existingRequest) {
      setExistingRequest(null)
    }
    if (joinRequestSubmitted) {
      setJoinRequestSubmitted(false)
    }
    if (submittedRequestOrg) {
      setSubmittedRequestOrg(null)
    }
  }

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const isAvailable = await checkSlugAvailability(orgForm.slug)
      if (!isAvailable) {
        setError('Organization slug already exists. Please choose a different name.')
        setLoading(false)
        return
      }

      const orgData: OrganizationData = {
        name: orgForm.name,
        slug: orgForm.slug,
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('User not authenticated')
        setLoading(false)
        return
      }

      await createOrganizationAndMembership(user.id, orgData)
      navigate('/dashboard', {
        state: { message: 'Organization created successfully!' },
      })
    } catch (creationError) {
      console.error('Organization creation error:', creationError)
      setError(creationError instanceof Error ? creationError.message : 'Failed to create organization')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('User not authenticated')
        setLoading(false)
        return
      }

      const existingJoinRequest = await checkExistingJoinRequest(joinForm.organizationSlug)
      if (existingJoinRequest) {
        setExistingRequest(existingJoinRequest)
        setLoading(false)
        return
      }

      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('slug', joinForm.organizationSlug)
        .single()

      if (orgError || !orgData) {
        setError('Organization not found. Please check the slug and try again.')
        setLoading(false)
        return
      }

      const { error: joinRequestError } = await supabase
        .from('organization_join_requests')
        .insert({
          organization_id: orgData.id,
          user_id: user.id,
        })

      if (joinRequestError) {
        console.error('Join request error:', joinRequestError)
        setError('Failed to submit join request. Please try again.')
        setLoading(false)
        return
      }

      setJoinRequestSubmitted(true)
      setSubmittedRequestOrg({
        organizationName: orgData.name,
        organizationSlug: joinForm.organizationSlug,
      })
    } catch (joinError) {
      console.error('Join organization error:', joinError)
      setError(joinError instanceof Error ? joinError.message : 'Failed to submit join request')
    } finally {
      setLoading(false)
    }
  }

  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

  const handleOrgNameChange = (name: string) => {
    setOrgForm((prev) => ({
      ...prev,
      name,
      slug: generateSlug(name),
    }))
  }

  const checkExistingJoinRequest = async (organizationSlug: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        return null
      }

      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .eq('slug', organizationSlug)
        .single()

      if (orgError || !orgData) {
        return null
      }

      const { data: existingRequestData, error: requestError } = await supabase
        .from('organization_join_requests')
        .select('*')
        .eq('organization_id', orgData.id)
        .eq('user_id', user.id)
        .single()

      if (requestError && requestError.code !== 'PGRST116') {
        console.error('Error checking existing request:', requestError)
        return null
      }

      if (existingRequestData) {
        return {
          organizationName: orgData.name,
          organizationSlug: orgData.slug,
        }
      }

      return null
    } catch (requestCheckError) {
      console.error('Error checking existing join request:', requestCheckError)
      return null
    }
  }

  const actionButtonLabel =
    mode === 'create'
      ? loading
        ? 'Creating...'
        : 'Create organization'
      : loading
        ? 'Submitting...'
        : 'Submit join request'

  return (
    <EntryShell
      accentBody="Create a new church workspace or request access to an existing one without dropping out of the new product shell."
      accentItems={[
        'Create a clean organization slug for staff and volunteer links.',
        'Handle join requests and memberships in the same onboarding lane.',
        'The setup experience now matches the dashboard’s spacing and token system.',
      ]}
      cardClassName="max-w-3xl"
      description="Choose how you want to get started with Spirit Lead."
      title="Set up your organization"
    >
      <div className="space-y-6">
        {error ? (
          <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            {error}
          </div>
        ) : null}

        {mode === 'select' ? (
          <div className="grid gap-4 md:grid-cols-2">
            <button
              className="card-shadow card-hover rounded-3xl border border-border bg-white p-6 text-left"
              onClick={() => setMode('create')}
              type="button"
            >
              <div className="mb-4 inline-flex rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-700">
                New workspace
              </div>
              <h3 className="text-xl font-semibold tracking-tight text-text-primary">
                Create new organization
              </h3>
              <p className="mt-3 text-sm leading-6 text-text-muted">
                Start a fresh organization for your church or ministry team.
              </p>
              <div className="mt-6">
                <span className="btn-primary">Create new</span>
              </div>
            </button>

            <button
              className="card-shadow card-hover rounded-3xl border border-border bg-white p-6 text-left"
              onClick={() => setMode('join')}
              type="button"
            >
              <div className="mb-4 inline-flex rounded-full bg-secondary-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-secondary-700">
                Existing workspace
              </div>
              <h3 className="text-xl font-semibold tracking-tight text-text-primary">
                Join existing organization
              </h3>
              <p className="mt-3 text-sm leading-6 text-text-muted">
                Request access to a team that already uses Spirit Lead.
              </p>
              <div className="mt-6">
                <span className="btn-secondary">Join existing</span>
              </div>
            </button>
          </div>
        ) : null}

        {mode === 'create' ? (
          <form className="space-y-5 rounded-3xl border border-border bg-slate-50/60 p-6" onSubmit={handleCreateOrganization}>
            <div className="space-y-1">
              <h3 className="text-xl font-semibold tracking-tight text-text-primary">Create your organization</h3>
              <p className="text-sm leading-6 text-text-muted">
                Set up the main organization record and your admin membership.
              </p>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-text-primary">Organization name</span>
              <input
                className="input-field"
                onChange={(e) => handleOrgNameChange(e.target.value)}
                placeholder="e.g., Grace Community Church"
                value={orgForm.name}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-text-primary">Organization URL</span>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-text-muted">
                  spiritlead.com/
                </span>
                <input
                  className="input-field"
                  onChange={(e) => setOrgForm((prev) => ({ ...prev, slug: e.target.value }))}
                  placeholder="grace-community"
                  value={orgForm.slug}
                />
              </div>
              <p className="text-xs text-text-muted">This becomes your unique organization slug.</p>
            </label>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button className="btn-secondary" onClick={() => setMode('select')} type="button">
                Back
              </button>
              <button className="btn-primary justify-center" disabled={loading} type="submit">
                {actionButtonLabel}
              </button>
            </div>
          </form>
        ) : null}

        {mode === 'join' && !joinRequestSubmitted && !existingRequest ? (
          <form className="space-y-5 rounded-3xl border border-border bg-slate-50/60 p-6" onSubmit={handleJoinOrganization}>
            <div className="space-y-1">
              <h3 className="text-xl font-semibold tracking-tight text-text-primary">Join an organization</h3>
              <p className="text-sm leading-6 text-text-muted">
                Enter the organization slug and we’ll send a join request to its admins.
              </p>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-text-primary">Organization slug</span>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-text-muted">
                  spiritlead.com/
                </span>
                <input
                  className="input-field"
                  onChange={(e) => handleOrganizationSlugChange(e.target.value)}
                  placeholder="organization-slug"
                  value={joinForm.organizationSlug}
                />
              </div>
              <p className="text-xs text-text-muted">Use the exact slug for the organization you want to join.</p>
            </label>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button className="btn-secondary" onClick={() => setMode('select')} type="button">
                Back
              </button>
              <button className="btn-primary justify-center" disabled={loading} type="submit">
                {actionButtonLabel}
              </button>
            </div>
          </form>
        ) : null}

        {mode === 'join' && existingRequest ? (
          <div className="rounded-3xl border border-primary-200 bg-primary-50/70 p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-xl text-white">
              ⏳
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-primary-800">
              Join request already submitted
            </h3>
            <p className="mt-3 text-sm leading-6 text-primary-800/80">
              You already have a pending request to join <strong>{existingRequest.organizationName}</strong>.
            </p>
            <p className="mt-1 text-sm text-primary-700/80">
              Organization: {existingRequest.organizationSlug}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                className="btn-secondary"
                onClick={() => {
                  setExistingRequest(null)
                  setJoinForm((prev) => ({ ...prev, organizationSlug: '' }))
                }}
                type="button"
              >
                Try different organization
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  setExistingRequest(null)
                  setMode('select')
                }}
                type="button"
              >
                Back to selection
              </button>
            </div>
          </div>
        ) : null}

        {mode === 'join' && joinRequestSubmitted ? (
          <div className="rounded-3xl border border-success-200 bg-success-50/80 p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-600 text-xl text-white">
              ✓
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-success-800">
              Join request submitted
            </h3>
            <p className="mt-3 text-sm leading-6 text-success-800/80">
              Your request to join <strong>{submittedRequestOrg?.organizationName}</strong> has been sent.
            </p>
            <p className="mt-1 text-sm text-success-700/80">
              Organization: {submittedRequestOrg?.organizationSlug}
            </p>
            <div className="mt-6 flex justify-center">
              <button className="btn-primary" onClick={() => navigate('/dashboard')} type="button">
                Go to dashboard
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </EntryShell>
  )
}
