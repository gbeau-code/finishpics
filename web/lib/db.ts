import { supabaseAdmin } from './supabase'

// Types
export type Meet = {
  id: string
  name: string
  date: string
  created_at?: string
}

export type Heat = {
  id: string
  meet_id: string
  event_num: string
  round: string
  heat_num: string
  event_name: string | null
  image_path: string
  image_width: number | null
  image_height: number | null
  first_frame_time: number | null
  last_frame_time: number | null
  created_at?: string
}

export type Athlete = {
  id: string
  heat_id: string
  bib: string
  first_name: string
  last_name: string
  team: string | null
  finish_time: number | null
  place: number | null
  created_at?: string
}

export type Order = {
  id: string
  athlete_id: string
  stripe_session_id: string
  stripe_payment_intent_id: string | null
  status: string
  customer_email: string | null
  amount_cents: number
  created_at?: string
}

export type AthleteWithContext = Athlete & {
  heat: Heat & {
    meet: Meet
  }
}

export async function getAthleteWithContext(athleteId: string): Promise<AthleteWithContext | null> {
  const { data, error } = await supabaseAdmin
    .from('athletes')
    .select(`
      *,
      heat:heats (
        *,
        meet:meets (*)
      )
    `)
    .eq('id', athleteId)
    .single()

  if (error || !data) return null

  return data as AthleteWithContext
}

export async function searchAthletes(query: string, meetId?: string): Promise<AthleteWithContext[]> {
  const q = query.trim().toLowerCase()

  let request = supabaseAdmin
    .from('athletes')
    .select(`
      *,
      heat:heats (
        *,
        meet:meets (*)
      )
    `)

  // Apply meet filter if provided
  if (meetId) {
    request = request.eq('heat.meet_id', meetId)
  }

  // Build OR filter: first_name, last_name, or bib
  const { data, error } = await request
    .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,bib.eq.${q}`)
    .limit(20)

  if (error) {
    console.error('searchAthletes error:', error)
    return []
  }

  return (data ?? []) as AthleteWithContext[]
}

export async function getOrCreateMeet(name: string, date: string): Promise<Meet> {
  // Try to find existing meet with same name and date
  const { data: existing } = await supabaseAdmin
    .from('meets')
    .select('*')
    .eq('name', name)
    .eq('date', date)
    .maybeSingle()

  if (existing) return existing as Meet

  // Create new meet
  const { data, error } = await supabaseAdmin
    .from('meets')
    .insert({ name, date })
    .select()
    .single()

  if (error || !data) throw new Error(`Failed to create meet: ${error?.message}`)

  return data as Meet
}

export async function createHeat(data: {
  meet_id: string
  event_num: string
  round: string
  heat_num: string
  event_name?: string | null
  image_path: string
  image_width?: number | null
  image_height?: number | null
  first_frame_time?: number | null
  last_frame_time?: number | null
}): Promise<Heat> {
  const { data: heat, error } = await supabaseAdmin
    .from('heats')
    .insert(data)
    .select()
    .single()

  if (error || !heat) throw new Error(`Failed to create heat: ${error?.message}`)

  return heat as Heat
}

export async function createAthlete(data: {
  heat_id: string
  bib: string
  first_name: string
  last_name: string
  team?: string | null
  finish_time?: number | null
  place?: number | null
}): Promise<Athlete> {
  const { data: athlete, error } = await supabaseAdmin
    .from('athletes')
    .insert(data)
    .select()
    .single()

  if (error || !athlete) throw new Error(`Failed to create athlete: ${error?.message}`)

  return athlete as Athlete
}

export async function getPaidOrderForAthlete(
  athleteId: string,
  sessionId: string
): Promise<Order | null> {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('stripe_session_id', sessionId)
    .eq('status', 'paid')
    .maybeSingle()

  if (error) {
    console.error('getPaidOrderForAthlete error:', error)
    return null
  }

  return data as Order | null
}

export async function getRecentMeets(limit = 10): Promise<Meet[]> {
  const { data, error } = await supabaseAdmin
    .from('meets')
    .select('*')
    .order('date', { ascending: false })
    .limit(limit)

  if (error) return []

  return (data ?? []) as Meet[]
}
