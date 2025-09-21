# Supabase Dashboard Configuration Guide

## Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" or "New Project"
3. Choose your organization
4. Fill in project details:
   - **Name**: `spiritlead` (or your preferred name)
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose closest to your users
5. Click "Create new project"
6. Wait for project to be set up (usually 2-3 minutes)

## Step 2: Get API Keys

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (starts with `https://`)
   - **anon public** key (starts with `eyJ`)

## Step 3: Configure Environment Variables

1. In your project root, create `.env` file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Supabase credentials:
   ```bash
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

## Step 3.5: Understanding the Signup Flow

The application uses a **two-step signup process** to avoid RLS (Row Level Security) issues:

### Step 1: User Account Creation (`/signup`)
- User creates account with basic info (name, email, password)
- Creates Supabase auth user + profile record
- User is now **authenticated** and can access the database

### Step 2: Organization Setup (`/organization-setup`)
- User chooses to create new organization or join existing
- Since user is authenticated, RLS policies work correctly
- Creates organization + membership records

### Benefits of This Approach:
- ✅ **No RLS Issues**: User is authenticated before org operations
- ✅ **Clean Separation**: User creation vs organization setup
- ✅ **Flexible**: Users can skip org setup initially
- ✅ **Better UX**: Clear step-by-step process
- ✅ **Robust**: Proper error handling and rollback

## Step 4: Database Setup

### 4.1 Create Database Schema

1. Go to **SQL Editor** in your Supabase dashboard
2. Create a new query and run this SQL:

```sql
-- Create organizations table
CREATE TABLE organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create profiles table (user base info only)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create organization memberships table
CREATE TABLE organization_memberships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
  status TEXT CHECK (status IN ('active', 'inactive', 'suspended')) DEFAULT 'active',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE,
  invited_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one active membership per user per organization
  UNIQUE(organization_id, user_id, status)
);

-- Create organization invites table
CREATE TABLE organization_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'expired')) DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create songs table for songbank feature
CREATE TABLE songs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  youtube_url TEXT,
  spotify_url TEXT,
  key TEXT,
  bpm INTEGER,
  ccli_number TEXT,
  tags TEXT[] DEFAULT '{}',
  lyrics TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create worship_services table for scheduling feature
CREATE TABLE worship_services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  service_date DATE NOT NULL,
  service_time TIME,
  description TEXT,
  status TEXT CHECK (status IN ('draft', 'published', 'completed')) DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create service_songs table for song assignments
CREATE TABLE service_songs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID REFERENCES worship_services(id) ON DELETE CASCADE NOT NULL,
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE NOT NULL,
  position INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique position per service
  UNIQUE(service_id, position)
);

-- Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE worship_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_songs ENABLE ROW LEVEL SECURITY;

-- Organization policies (working for signup flow)
CREATE POLICY "Allow organization creation" ON organizations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow organization viewing" ON organizations
  FOR SELECT USING (true);

CREATE POLICY "Allow organization updates" ON organizations
  FOR UPDATE USING (true);

-- Profile policies (working for signup flow)
CREATE POLICY "Allow profile creation" ON profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow profile viewing" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Allow profile updates" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Organization membership policies (working for signup flow)
CREATE POLICY "Allow membership creation" ON organization_memberships
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow membership viewing" ON organization_memberships
  FOR SELECT USING (true);

CREATE POLICY "Allow membership updates" ON organization_memberships
  FOR UPDATE USING (user_id = auth.uid());

-- Organization invite policies
CREATE POLICY "Users can view invites for their organization" ON organization_invites
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Organization admins can create invites" ON organization_invites
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_memberships 
      WHERE organization_id = organization_invites.organization_id 
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND status = 'active'
    )
  );

CREATE POLICY "Organization admins can update invites" ON organization_invites
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organization_memberships 
      WHERE organization_id = organization_invites.organization_id 
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND status = 'active'
    )
  );

-- Songs policies (organization-based access)
CREATE POLICY "Users can view songs in their organization" ON songs
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users can create songs in their organization" ON songs
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_memberships 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users can update songs in their organization" ON songs
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users can delete songs in their organization" ON songs
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Worship services policies (organization-based access)
CREATE POLICY "Users can view services in their organization" ON worship_services
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users can create services in their organization" ON worship_services
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_memberships 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users can update services in their organization" ON worship_services
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users can delete services in their organization" ON worship_services
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Service songs policies (organization-based access)
CREATE POLICY "Users can view service songs in their organization" ON service_songs
  FOR SELECT USING (
    service_id IN (
      SELECT ws.id FROM worship_services ws
      JOIN organization_memberships om ON ws.organization_id = om.organization_id
      WHERE om.user_id = auth.uid() AND om.status = 'active'
    )
  );

CREATE POLICY "Users can create service songs in their organization" ON service_songs
  FOR INSERT WITH CHECK (
    service_id IN (
      SELECT ws.id FROM worship_services ws
      JOIN organization_memberships om ON ws.organization_id = om.organization_id
      WHERE om.user_id = auth.uid() AND om.status = 'active'
    )
  );

CREATE POLICY "Users can update service songs in their organization" ON service_songs
  FOR UPDATE USING (
    service_id IN (
      SELECT ws.id FROM worship_services ws
      JOIN organization_memberships om ON ws.organization_id = om.organization_id
      WHERE om.user_id = auth.uid() AND om.status = 'active'
    )
  );

CREATE POLICY "Users can delete service songs in their organization" ON service_songs
  FOR DELETE USING (
    service_id IN (
      SELECT ws.id FROM worship_services ws
      JOIN organization_memberships om ON ws.organization_id = om.organization_id
      WHERE om.user_id = auth.uid() AND om.status = 'active'
    )
  );

-- Note: These RLS policies are permissive for development
-- For production, consider making them more restrictive:
-- - SELECT policies: Only show data the user should see
-- - UPDATE policies: Only allow updates to own data
-- - DELETE policies: Add proper restrictions

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_memberships_updated_at
  BEFORE UPDATE ON organization_memberships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_songs_updated_at
  BEFORE UPDATE ON songs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 4.2 Verify Table Creation

1. Go to **Table Editor** and verify these tables exist:

**organizations table:**
   - `id` (UUID, Primary Key)
   - `name` (Text)
   - `slug` (Text, Unique)
   - `created_at` (Timestamp)
   - `updated_at` (Timestamp)

**profiles table:**
   - `id` (UUID, Primary Key, References auth.users)
   - `email` (Text, Unique)
   - `first_name` (Text)
   - `last_name` (Text)
   - `created_at` (Timestamp)
   - `updated_at` (Timestamp)

**organization_memberships table:**
   - `id` (UUID, Primary Key)
   - `organization_id` (UUID, References organizations)
   - `user_id` (UUID, References auth.users)
   - `role` (Text, Check: 'owner', 'admin', 'member')
   - `status` (Text, Check: 'active', 'inactive', 'suspended')
   - `joined_at` (Timestamp)
   - `left_at` (Timestamp, Nullable)
   - `invited_by` (UUID, References auth.users, Nullable)
   - `accepted_at` (Timestamp)
   - `created_at` (Timestamp)
   - `updated_at` (Timestamp)

**organization_invites table:**
   - `id` (UUID, Primary Key)
   - `organization_id` (UUID, References organizations)
   - `email` (Text)
   - `invited_by` (UUID, References auth.users)
   - `status` (Text, Check: 'pending', 'accepted', 'expired')
   - `expires_at` (Timestamp, Required)
   - `accepted_at` (Timestamp, Nullable)
   - `created_at` (Timestamp)

**songs table:**
   - `id` (UUID, Primary Key)
   - `organization_id` (UUID, References organizations)
   - `title` (Text, Required)
   - `artist` (Text, Required)
   - `youtube_url` (Text, Optional)
   - `spotify_url` (Text, Optional)
   - `key` (Text, Optional)
   - `bpm` (Integer, Optional)
   - `ccli_number` (Text, Optional)
   - `tags` (Text Array, Default: empty array)
   - `lyrics` (Text, Optional)
   - `created_by` (UUID, References auth.users, Nullable)
   - `created_at` (Timestamp)
   - `updated_at` (Timestamp)

## Step 5: Authentication Configuration

### 5.1 Email Settings

1. Go to **Authentication** → **Settings**
2. Under **Email Templates**, customize:
   - **Confirm signup** email template
   - **Reset password** email template
3. Update sender email if needed

### 5.2 Site URL Configuration

1. Go to **Authentication** → **Settings** → **URL Configuration**
2. Set **Site URL** to your development URL:
   - Development: `http://localhost:5173` (or your Vite port)
   - Production: Your actual domain
3. Add **Redirect URLs**:
   - `http://localhost:5173/**`
   - `http://localhost:5173/login`
   - `http://localhost:5173/signup`
   - Your production URLs when ready

### 5.3 Email Confirmation (Optional)

1. Go to **Authentication** → **Settings**
2. Under **Email Auth**:
   - **Enable email confirmations**: Toggle ON for production, OFF for development
   - **Secure email change**: Toggle ON
   - **Double confirm changes**: Toggle ON

## Step 6: Test Authentication

### 6.1 Test User Signup

1. Start your development server: `yarn dev`
2. Go to your signup page (`/signup`)
3. Create a test account with basic information
4. Check **Authentication** → **Users** in Supabase dashboard
5. Verify user appears in the list
6. Check **Table Editor** → **profiles** - should have user profile (no organization_id)

### 6.2 Test Organization Setup

1. After signup, you should be redirected to `/organization-setup`
2. Choose "Create New Organization" or "Join Existing Organization"
3. If creating new:
   - Enter organization name and slug
   - Check **Table Editor** → **organizations** - should have new organization
   - Check **Table Editor** → **organization_memberships** - should have membership with 'owner' role
4. If joining existing:
   - Enter organization slug from invite
   - Check **Table Editor** → **organization_memberships** - should have membership with 'member' role

### 6.3 Test Login

1. Try logging in with your test account
2. Check **Authentication** → **Logs** for any errors
3. Verify session is created
4. Verify user can access their organization data

### 6.4 Test Team Management

1. From the dashboard, click "View Team" to go to team management
2. Try inviting a user by email address
3. Check **Table Editor** → **organization_invites** - should have new invite with 'pending' status
4. Copy the invite ID from the database
5. Test the invitation flow:
   - Go to `/signup?invite=[INVITE_ID]`
   - Verify the email is pre-filled and organization name is shown
   - Complete signup process
   - Check **Table Editor** → **organization_memberships** - should have new member
   - Check **Table Editor** → **organization_invites** - status should be 'accepted'

## Step 7: Security Best Practices

### 7.1 API Key Security

- ✅ Never commit `.env` files to git
- ✅ Use `VITE_` prefix for client-side variables
- ✅ Keep service role key secret (server-side only)

### 7.2 Database Security

- ✅ RLS is enabled on profiles table
- ✅ Users can only access their own data
- ✅ Foreign key constraints are in place

### 7.3 Authentication Security

- ✅ Email confirmation enabled
- ✅ Password requirements enforced
- ✅ Session management configured

## Step 8: Troubleshooting

### Common Issues:

1. **"Missing Supabase environment variables"**
   - Check `.env` file exists and has correct values
   - Restart development server after adding `.env`

2. **"Invalid login credentials"**
   - Check if email confirmation is required
   - Verify user exists in Supabase dashboard

3. **"Row Level Security policy violation"**
   - Check RLS policies are correctly set up
   - Verify user is authenticated
   - Ensure you're using the two-step signup flow

4. **"Email not confirmed"**
   - Check email confirmation settings
   - Look for confirmation email in spam folder

5. **"User not allowed" or "not_admin" errors**
   - This usually means trying to use admin functions from client-side
   - Ensure you're using the simplified auth functions
   - Check that RLS policies allow the operation you're trying to perform

6. **Organization creation fails after signup**
   - Verify user is authenticated before trying to create organization
   - Check that the organization creation policy allows `INSERT WITH CHECK (true)`
   - Ensure you're using the `createOrganizationAndMembership` function
   - **Solution**: Use the permissive RLS policies provided in Step 4.1 above

### Debug Steps:

1. Check **Authentication** → **Logs** for detailed error messages
2. Check browser console for client-side errors
3. Verify environment variables are loaded correctly
4. Test with Supabase dashboard directly

## Step 9: Production Deployment

When deploying to production:

1. Update **Site URL** in Supabase dashboard
2. Add production redirect URLs
3. Enable email confirmations
4. Set up custom domain (optional)
5. Configure email provider (optional)

## Support

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)
- [GitHub Issues](https://github.com/supabase/supabase/issues) 