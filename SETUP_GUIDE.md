# Task Manager - Auth0 + Supabase Setup Guide

This guide walks you through setting up Auth0 authentication with Supabase database for your task manager application.

## Architecture Overview

- **Auth0**: Handles user authentication (login/signup/sessions)
- **Supabase**: Database storage for tasks, categories, and user data
- **Integration**: Auth0 users are mapped to Supabase `app_users` table via `auth0_sub` field
- **Security**: All database operations use Supabase service role, with permissions enforced at the API level

## Step 1: Configure Supabase

### 1.1 Get Your Supabase Credentials

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project (or create a new one)
3. Go to **Project Settings** > **API**
4. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (under "Project API keys")
   - **service_role key** (under "Project API keys" - keep this secret!)

### 1.2 Run Database Migrations

You need to apply the latest migration to set up the Auth0-compatible schema:

**Option A: Using Supabase CLI (Recommended)**
```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Login to Supabase
supabase login

# Link your project (replace with your project reference)
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

**Option B: Using SQL Editor in Supabase Dashboard**
1. Go to **SQL Editor** in your Supabase Dashboard
2. Copy the contents of `supabase/migrations/20251003001_auth0_restructure.sql`
3. Paste and run the migration

This will create:
- `app_users` - Maps Auth0 users to your app
- `categories` - Task categories
- `category_members` - User roles per category (owner/editor/viewer)
- `tasks` - User tasks

## Step 2: Configure Auth0

### 2.1 Get Your Auth0 Credentials

1. Go to your [Auth0 Dashboard](https://manage.auth0.com)
2. Go to **Applications** > Your Application
3. Copy these values:
   - **Domain** (e.g., `your-tenant.auth0.com`)
   - **Client ID**
   - **Client Secret**

### 2.2 Configure Auth0 Application Settings

In your Auth0 Application settings, configure:

**Allowed Callback URLs:**
```
http://localhost:3000/api/auth/callback
```

**Allowed Logout URLs:**
```
http://localhost:3000
```

**Allowed Web Origins:**
```
http://localhost:3000
```

> **Note**: When deploying to production, add your production URLs to these fields as well (e.g., `https://yourdomain.com/api/auth/callback`)

### 2.3 Enable User Management

1. In Auth0 Dashboard, go to **Authentication** > **Database**
2. Ensure you have a database connection enabled (typically "Username-Password-Authentication")
3. Enable the connection for your application if not already enabled

## Step 3: Configure Environment Variables

Create a `.env` file in the root of your project:

```bash
# Auth0 Configuration
AUTH0_SECRET='use-openssl-rand-hex-32-for-this-value'
AUTH0_BASE_URL='http://localhost:3000'
AUTH0_ISSUER_BASE_URL='https://YOUR_AUTH0_DOMAIN.auth0.com'
AUTH0_CLIENT_ID='your_auth0_client_id'
AUTH0_CLIENT_SECRET='your_auth0_client_secret'

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL='https://your-project.supabase.co'
NEXT_PUBLIC_SUPABASE_ANON_KEY='your_anon_key'
SUPABASE_SERVICE_ROLE_KEY='your_service_role_key'
```

### Generate AUTH0_SECRET

Run this command in your terminal:
```bash
openssl rand -hex 32
```

Copy the output and use it as your `AUTH0_SECRET` value.

### Fill in the values:

- **AUTH0_ISSUER_BASE_URL**: Your Auth0 domain with `https://` prefix (e.g., `https://dev-abc123.auth0.com`)
- **AUTH0_CLIENT_ID**: From Auth0 Application settings
- **AUTH0_CLIENT_SECRET**: From Auth0 Application settings
- **NEXT_PUBLIC_SUPABASE_URL**: Your Supabase project URL
- **NEXT_PUBLIC_SUPABASE_ANON_KEY**: Your Supabase anon key
- **SUPABASE_SERVICE_ROLE_KEY**: Your Supabase service role key

## Step 4: Test Your Setup

### 4.1 Install Dependencies
```bash
npm install
```

### 4.2 Start Development Server
```bash
npm run dev
```

### 4.3 Test Authentication Flow

1. Open [http://localhost:3000](http://localhost:3000)
2. Click "Sign Up" or "Login"
3. You should be redirected to Auth0's login page
4. After logging in, you should be redirected back to your app
5. Navigate to `/dashboard` - you should see the dashboard page

### 4.4 Verify Database Connection

After logging in for the first time:
1. Go to your Supabase Dashboard > **Table Editor**
2. Check the `app_users` table
3. You should see a new row with your Auth0 user's `auth0_sub` and email

## Step 5: Understanding the Permission System

### Role-Based Access Control

This app uses a category-based permission system:

- **Owner**: Full control (can manage members, edit, delete category)
- **Editor**: Can create and edit tasks in the category
- **Viewer**: Can only view tasks in the category

### How It Works

1. When a user creates a category, they become the **owner** via `category_members` table
2. Owners can invite other users and assign them roles
3. All permissions are checked in the API routes using `lib/permissions.ts`
4. The `getUserRoleForCategory()` function checks a user's role for a specific category
5. `canEdit()` and `canAdmin()` helper functions enforce permissions

### Key Files

- `lib/auth-helpers.ts` - User authentication utilities
- `lib/permissions.ts` - Permission checking logic
- `lib/supabase-admin.ts` - Supabase admin client (service role)
- `middleware.ts` - Protects routes requiring authentication

## Production Deployment

### Update Auth0 Settings

When deploying to production, add your production URL to Auth0:

**Allowed Callback URLs:**
```
https://yourdomain.com/api/auth/callback
```

**Allowed Logout URLs:**
```
https://yourdomain.com
```

**Allowed Web Origins:**
```
https://yourdomain.com
```

### Update Environment Variables

Update `.env` (or your hosting platform's environment variables):
```bash
AUTH0_BASE_URL='https://yourdomain.com'
# Keep other variables the same
```

## Troubleshooting

### "Missing env.NEXT_PUBLIC_SUPABASE_URL" Error
- Ensure your `.env` file exists in the project root
- Verify all required environment variables are set
- Restart your development server after adding environment variables

### "Unauthorized" Error
- Check that your Auth0 callback URLs are correctly configured
- Verify your `AUTH0_SECRET` is properly generated
- Check browser console for specific Auth0 errors

### Database Connection Issues
- Verify your Supabase credentials are correct
- Ensure migrations have been applied
- Check Supabase Dashboard > Logs for any errors

### Users Not Created in Supabase
- Check that your `SUPABASE_SERVICE_ROLE_KEY` is correct (not the anon key)
- Look at API route logs for any database errors
- Verify the `app_users` table exists in Supabase

## Next Steps

Once everything is working:

1. **Customize Categories**: Modify the category creation flow in `app/api/categories/route.ts`
2. **Add User Profiles**: Extend `app_users` table with additional user information
3. **Email Notifications**: Set up Auth0 email templates or integrate a notification service
4. **Advanced Permissions**: Add more granular permissions if needed

## Support

If you encounter issues:
- Check the [Auth0 Documentation](https://auth0.com/docs)
- Check the [Supabase Documentation](https://supabase.com/docs)
- Review API route error logs in your terminal

