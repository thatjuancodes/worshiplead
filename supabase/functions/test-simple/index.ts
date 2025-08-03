// @deno-types="https://deno.land/x/types/index.d.ts"
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  // Simple response
  return new Response(
    JSON.stringify({ 
      success: true, 
      message: 'Simple test function working!',
      timestamp: new Date().toISOString()
    }),
    { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  )
}) 