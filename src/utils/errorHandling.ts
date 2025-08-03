export interface ApiError {
  message: string
  status?: number
  code?: string
}

export function handleApiError(error: unknown): ApiError {
  if (error instanceof Error) {
    return {
      message: error.message,
      code: error.name
    }
  }

  if (typeof error === 'string') {
    return {
      message: error
    }
  }

  return {
    message: 'An unexpected error occurred'
  }
}

export function displayErrorMessage(error: ApiError): string {
  return `Error: ${error.message}${error.code ? ` (${error.code})` : ''}`
} 