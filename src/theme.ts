import { extendTheme } from '@chakra-ui/react'

export const theme = extendTheme({
  config: {
    initialColorMode: 'light',
    useSystemColorMode: false,
  },
  fonts: {
    heading: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    body: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  colors: {
    blue: {
      50: '#EFF6FF',
      100: '#DBEAFE',
      200: '#BFDBFE',
      300: '#93C5FD',
      400: '#60A5FA',
      500: '#3B82F6',
      600: '#2563EB',
      700: '#1D4ED8',
      800: '#1E40AF',
      900: '#1E3A8A',
    },
    teal: {
      50: '#F0FDFA',
      100: '#CCFBF1',
      200: '#99F6E4',
      300: '#5EEAD4',
      400: '#2DD4BF',
      500: '#14B8A6',
      600: '#0EA5A4',
      700: '#0D9488',
      800: '#0F766E',
      900: '#115E59',
    },
    green: {
      50: '#F0FDF4',
      100: '#DCFCE7',
      200: '#BBF7D0',
      300: '#86EFAC',
      400: '#4ADE80',
      500: '#22C55E',
      600: '#16A34A',
      700: '#15803D',
      800: '#166534',
      900: '#14532D',
    },
    red: {
      50: '#FEF2F2',
      100: '#FEE2E2',
      200: '#FECACA',
      300: '#FCA5A5',
      400: '#F87171',
      500: '#EF4444',
      600: '#DC2626',
      700: '#B91C1C',
      800: '#991B1B',
      900: '#7F1D1D',
    },
    gray: {
      50: '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      300: '#CBD5E1',
      400: '#94A3B8',
      500: '#64748B',
      600: '#475569',
      700: '#334155',
      800: '#1E293B',
      900: '#0F172A',
    },
  },
  radii: {
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    '2xl': '20px',
  },
  shadows: {
    outline: '0 0 0 3px rgba(59, 130, 246, 0.25)',
    sm: '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.04)',
    md: '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(0, 0, 0, 0.02)',
    lg: '0 4px 12px rgba(0, 0, 0, 0.08), 0 8px 24px rgba(0, 0, 0, 0.04)',
  },
  styles: {
    global: {
      'html, body': {
        bg: 'gray.50',
        color: 'gray.900',
      },
      body: {
        fontFamily: 'body',
      },
    },
  },
  components: {
    Button: {
      baseStyle: {
        borderRadius: 'lg',
        fontWeight: '600',
      },
      sizes: {
        md: {
          px: 4,
          py: 2.5,
          h: 'auto',
        },
        lg: {
          px: 6,
          py: 3,
          h: 'auto',
        },
      },
      variants: {
        solid: {
          bg: 'blue.600',
          color: 'white',
          _hover: {
            bg: 'blue.700',
          },
        },
        outline: {
          bg: 'white',
          borderColor: 'gray.200',
          color: 'gray.900',
          _hover: {
            bg: 'gray.50',
          },
        },
        ghost: {
          color: 'gray.500',
          _hover: {
            bg: 'gray.50',
            color: 'gray.900',
          },
        },
      },
      defaultProps: {
        colorScheme: 'blue',
      },
    },
    Input: {
      variants: {
        outline: {
          field: {
            bg: 'white',
            borderColor: 'gray.200',
            borderRadius: 'lg',
            _hover: {
              borderColor: 'gray.300',
            },
            _focusVisible: {
              borderColor: 'blue.500',
              boxShadow: 'outline',
            },
          },
        },
      },
      defaultProps: {
        variant: 'outline',
      },
    },
    Textarea: {
      variants: {
        outline: {
          bg: 'white',
          borderColor: 'gray.200',
          borderRadius: 'lg',
          _hover: {
            borderColor: 'gray.300',
          },
          _focusVisible: {
            borderColor: 'blue.500',
            boxShadow: 'outline',
          },
        },
      },
      defaultProps: {
        variant: 'outline',
      },
    },
    Select: {
      variants: {
        outline: {
          field: {
            bg: 'white',
            borderColor: 'gray.200',
            borderRadius: 'lg',
            _hover: {
              borderColor: 'gray.300',
            },
            _focusVisible: {
              borderColor: 'blue.500',
              boxShadow: 'outline',
            },
          },
        },
      },
      defaultProps: {
        variant: 'outline',
      },
    },
    Menu: {
      baseStyle: {
        list: {
          borderRadius: 'xl',
          borderColor: 'gray.200',
          boxShadow: 'md',
          py: 2,
        },
        item: {
          borderRadius: 'md',
          mx: 2,
          width: 'calc(100% - 1rem)',
        },
      },
    },
    Badge: {
      baseStyle: {
        borderRadius: 'full',
        px: 2.5,
        py: 0.5,
        textTransform: 'none',
        fontWeight: '600',
      },
    },
    Container: {
      baseStyle: {
        maxW: '1200px',
      },
    },
  },
})
