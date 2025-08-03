# Hosting Guide

This file is intentionally excluded from version control.

To access the full hosted deployment guide (with superadmin setup and SaaS configurations), refer to your private deployment notes or internal documentation.

## For Open Source Contributors

This project supports both self-hosted and cloud-hosted deployments. The cloud-hosted version includes additional features and configurations that are not part of the open-source codebase.

If you're interested in the cloud-hosted version, please contact the project maintainers.

## Self-Hosting

For self-hosting, follow the standard setup instructions in the main README and SUPABASE_SETUP.md files.

### Database Structure

The project uses a multi-tenant SaaS architecture with:

- **organizations**: Organization details and settings
- **profiles**: User base information (no organization-specific data)
- **organization_memberships**: Links users to organizations with roles and status
- **organization_invites**: Manages invitation workflow

This structure supports:
- Users belonging to multiple organizations
- Complete membership history and audit trails
- Role-based access control (owner, admin, member)
- Membership status management (active, inactive, suspended)

## Support

- **Open Source**: GitHub Issues
- **Cloud Hosted**: Contact project maintainers 