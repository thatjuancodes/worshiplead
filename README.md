# WorshipLead

A vanilla React TypeScript project built with Vite, following modern development practices and user-defined coding standards.

## Features

- ⚡️ **Vite** - Fast build tool and development server
- ⚛️ **React 19** - Latest stable version with modern features
- 🔷 **TypeScript** - Type-safe development
- 🎨 **Modular Architecture** - Reusable components following DRY principles
- 🛡️ **Error Handling** - Proper error handling utilities
- 📏 **ESLint** - Code quality and consistency

## Project Structure

```
src/
├── components/          # Reusable React components
│   ├── Counter.tsx     # Counter component with state management
│   ├── LogoSection.tsx # Logo display component
│   ├── InfoSection.tsx # Information display component
│   └── index.ts        # Component exports
├── utils/              # Utility functions
│   └── errorHandling.ts # Error handling utilities
├── assets/             # Static assets
├── App.tsx             # Main application component
├── main.tsx            # Application entry point
└── index.css           # Global styles
```

## Development Standards

This project follows specific user-defined rules:

- ✅ No `React.FC` usage - Standard function components with inferred or explicit typing
- ✅ Empty newlines between sibling elements/components for better readability
- ✅ Proper error handling with user-friendly error messages
- ✅ DRY principles - Modular and reusable code
- ✅ Best practices for React and TypeScript development

## Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- Yarn package manager

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   yarn install
   ```

### Development

Start the development server:
```bash
yarn dev
```

The application will be available at `http://localhost:5173`

### Building

Build for production:
```bash
yarn build
```

### Code Quality

Run linting:
```bash
yarn lint
```

Type checking:
```bash
yarn tsc --noEmit
```

## Available Scripts

- `yarn dev` - Start development server
- `yarn build` - Build for production
- `yarn preview` - Preview production build
- `yarn lint` - Run ESLint

## Dependencies

### Core Dependencies
- **React**: ^19.1.0 (Latest stable)
- **React DOM**: ^19.1.0 (Latest stable)

### Development Dependencies
- **Vite**: ^7.0.4 (Build tool)
- **TypeScript**: ~5.8.3 (Type safety)
- **ESLint**: ^9.30.1 (Code linting)
- **@vitejs/plugin-react**: ^4.6.0 (React support for Vite)

## Error Handling

The project includes a comprehensive error handling system in `src/utils/errorHandling.ts`:

- `handleApiError()` - Standardizes error objects
- `displayErrorMessage()` - Formats errors for user display
- `ApiError` interface - Type-safe error structure

## Supabase Setup

### Prerequisites

1. Create a Supabase project at [https://supabase.com](https://supabase.com)
2. Get your project URL and anon key from the API settings

### Environment Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Add your Supabase credentials to `.env`:
   ```bash
   VITE_SUPABASE_URL=your_supabase_project_url_here
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```

### Database Setup

1. Create a `profiles` table in your Supabase database:
   ```sql
   CREATE TABLE profiles (
     id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
     email TEXT UNIQUE NOT NULL,
     first_name TEXT NOT NULL,
     last_name TEXT NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

2. Set up Row Level Security (RLS):
   ```sql
   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "Users can view own profile" ON profiles
     FOR SELECT USING (auth.uid() = id);
   
   CREATE POLICY "Users can update own profile" ON profiles
     FOR UPDATE USING (auth.uid() = id);
   
   CREATE POLICY "Users can insert own profile" ON profiles
     FOR INSERT WITH CHECK (auth.uid() = id);
   ```

3. Create a trigger to automatically update the `updated_at` column:
   ```sql
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
   ```

### Authentication

The app includes:
- User registration with email/password
- User login/logout
- Session management
- Profile creation and management
- Error handling with user-friendly messages

## Contributing

1. Follow the established coding standards
2. Ensure all components are properly typed
3. Add empty newlines between sibling elements
4. Handle errors appropriately
5. Keep code modular and reusable
