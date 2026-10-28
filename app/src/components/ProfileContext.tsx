import { createContext, useContext } from 'react'
import { saveProfile, type Profile } from '../lib/db'

export const ProfileContext = createContext<{ profile: Profile; refresh: () => void } | null>(null)
export function useProfile() {
  const c = useContext(ProfileContext)!
  return { ...c, save: async (p: Partial<Profile>) => { await saveProfile(p); c.refresh() } }
}
