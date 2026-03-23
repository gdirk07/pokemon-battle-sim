import { create } from 'zustand'
import type { BattleState } from '../../../shared/types/battle'

interface BattleStore {
    battle: BattleState | null
    isConnected: boolean
    setBattle: (battle: BattleState) => void
    setConnected: (connected: boolean) => void
    reset: () => void
}

export const useBattleStore = create<BattleStore>((set) => ({
    battle: null,
    isConnected: false,
    setBattle: (battle) => set({ battle }),
    setConnected: (isConnected) => set({ isConnected }),
    reset:() => set({ battle: null }),
}))