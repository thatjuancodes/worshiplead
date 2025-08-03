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
│   ├── Header.tsx      # Navigation header component
│   ├── HeroSection.tsx # Landing page hero section
│   ├── FeaturesSection.tsx # Features showcase
│   ├── Footer.tsx      # Footer component
│   └── index.ts        # Component exports
├── pages/              # Page components
│   ├── HomePage.tsx    # Landing page
│   ├── LoginPage.tsx   # User login page
│   ├── SignupPage.tsx  # User registration page
│   ├── Dashboard.tsx   # Main dashboard
│   └── OrganizationSetup.tsx # Organization setup page
├── lib/                # Library utilities
│   ├── supabase.ts     # Supabase client configuration
│   └── auth.ts         # Authentication functions
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

The project includes comprehensive error handling throughout the application:

- Proper error boundaries and user-friendly error messages
- Type-safe error handling in authentication functions
- Graceful fallbacks for network and API errors

## Supabase Setup

For detailed Supabase configuration instructions, see [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).

### Quick Start

1. Create a Supabase project at [https://supabase.com](https://supabase.com)
2. Copy the example environment file: `cp .env.example .env`
3. Add your Supabase credentials to `.env`
4. Follow the complete setup guide in `docs/SUPABASE_SETUP.md`

### Authentication

The app includes:
- Multi-tenant organization-based user registration
- User login/logout with session management
- Organization invite system
- Role-based access control (Owner, Admin, Member)
- Error handling with user-friendly messages

## Contributing

1. Follow the established coding standards
2. Ensure all components are properly typed
3. Add empty newlines between sibling elements
4. Handle errors appropriately
5. Keep code modular and reusable
