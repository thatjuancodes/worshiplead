# Volunteer System Setup Guide

This guide explains how to set up and use the volunteer system for worship services.

## Overview

The volunteer system allows organizations to create public volunteer links that users can access to sign up for worship services. When a user accesses a volunteer link, they can:

1. Log in with an existing account or create a new one
2. View available published services
3. Volunteer for specific services
4. Get automatically added to the organization

## Database Setup

### 1. Run the Migration

Execute the SQL migration file to create the required tables:

```bash
# In your Supabase dashboard, go to SQL Editor and run:
supabase/migrations/001_create_volunteer_tables.sql
```

This creates:
- `organization_volunteer_links` - Stores volunteer links for each organization
- `worship_service_volunteers` - Tracks which users are volunteering for which services

### 2. Verify Table Creation

Check that the tables were created successfully in your Supabase Table Editor:

- **organization_volunteer_links**: Should have columns for `id`, `organization_id`, `public_url`, `created_at`, `updated_at`
- **worship_service_volunteers**: Should have columns for `id`, `worship_service_id`, `user_id`, `created_at`, `updated_at`

## How It Works

### 1. Creating Volunteer Links

- Organization admins can click "Copy volunteer link" on the Dashboard
- If no volunteer link exists, one is automatically created
- The link format is: `{app_base_url}/volunteer/{public_url}`

### 2. User Access Flow

1. User clicks volunteer link
2. If not logged in, they see login/signup options
3. After authentication, they're automatically added to the organization
4. They can view available published services
5. They can volunteer for specific services

### 3. Service Assignment

- Users can only see published (not draft or completed) services
- Users can volunteer for multiple services
- The system prevents duplicate assignments
- All assignments are tracked in `worship_service_volunteers`

## Security Features

### Row Level Security (RLS)

- **organization_volunteer_links**: Public read access, organization members can manage
- **worship_service_volunteers**: Users can only see/manage their own assignments

### Automatic Organization Membership

- Users accessing volunteer links are automatically added to the organization
- They get 'member' role with 'active' status
- This ensures they can view and interact with organization data

## Usage Examples

### For Organization Admins

1. Go to Dashboard
2. Click "Copy volunteer link" above the Songs section
3. Share the copied link with potential volunteers
4. Monitor volunteer assignments in the service details

### For Volunteers

1. Click the volunteer link
2. Log in or create account
3. Browse available services
4. Click "Volunteer for This Service" on desired services

## Troubleshooting

### Common Issues

1. **"Invalid volunteer link" error**
   - Check that the `organization_volunteer_links` table exists
   - Verify the public_url in the URL matches a record in the table

2. **Users can't see services**
   - Ensure services have status 'published' (not 'draft' or 'completed')
   - Check that the user was added to the organization successfully

3. **Permission errors**
   - Verify RLS policies are properly set up
   - Check that the user has an active organization membership

### Database Queries

To check volunteer assignments:

```sql
-- View all volunteers for a specific service
SELECT 
  wsv.*,
  p.first_name,
  p.last_name,
  p.email
FROM worship_service_volunteers wsv
JOIN profiles p ON wsv.user_id = p.id
WHERE wsv.worship_service_id = 'your-service-id';

-- View all services a user is volunteering for
SELECT 
  wsv.*,
  ws.title,
  ws.service_date
FROM worship_service_volunteers wsv
JOIN worship_services ws ON wsv.worship_service_id = ws.id
WHERE wsv.user_id = 'your-user-id';
```

## Future Enhancements

Potential improvements to consider:

1. **Email notifications** when users volunteer for services
2. **Volunteer roles** (e.g., "worship leader", "musician", "sound tech")
3. **Service requirements** (e.g., minimum volunteers needed)
4. **Volunteer availability** scheduling
5. **Service reminders** for assigned volunteers

## Support

If you encounter issues:

1. Check the browser console for JavaScript errors
2. Verify database tables and RLS policies
3. Check Supabase logs for database errors
4. Ensure all required environment variables are set
