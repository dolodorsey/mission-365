import { createClient } from '@supabase/supabase-js'
import { MISSION365_SUPABASE_PUBLISHABLE_KEY, MISSION365_SUPABASE_URL } from './mission365-public'

export const supabaseConfigured = true
export const supabase = createClient(MISSION365_SUPABASE_URL, MISSION365_SUPABASE_PUBLISHABLE_KEY)
