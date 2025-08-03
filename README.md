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

## Contributing

1. Follow the established coding standards
2. Ensure all components are properly typed
3. Add empty newlines between sibling elements
4. Handle errors appropriately
5. Keep code modular and reusable
