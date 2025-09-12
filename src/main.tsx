import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ChakraProvider } from '@chakra-ui/react'
import { theme } from '@chakra-ui/theme'
import App from './App.tsx'
import './lib/i18n'
// Polyfill Buffer/process for browser builds when Node deps expect them
import { Buffer } from 'buffer'
import process from 'process'
// @ts-ignore
if (!window.Buffer) window.Buffer = Buffer
// @ts-ignore
if (!window.process) window.process = process

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChakraProvider theme={theme}>
      <App />
    </ChakraProvider>
  </StrictMode>,
)
