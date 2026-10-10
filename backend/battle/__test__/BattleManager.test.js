import { describe, it, expect, beforeAll } from 'vitest';
const BattleManager = require('../BattleManager');

describe('BattleManager', () => {
    let originalCounter;
    let originalBattles;

    beforeAll(() => {
        // Save original state if needed for multiple test runs
        originalCounter = BattleManager.counter;
    });

    it('creates a new battle with unique ID', () => {
        const battle = BattleManager.createBattle();
        expect(battle).toBeDefined();
        expect(battle.id).toMatch(/^battle-\d+$/);
    });

    it('assigns sequential IDs to battles', () => {
        const battle1 = BattleManager.createBattle();
        const battle2 = BattleManager.createBattle();
        const battle3 = BattleManager.createBattle();

        expect(battle1.id).toMatch(/^battle-\d+$/);
        expect(battle2.id).toMatch(/^battle-\d+$/);
        expect(battle3.id).toMatch(/^battle-\d+$/);
        expect(parseInt(battle1.id.split('-')[1])).toBeLessThan(parseInt(battle2.id.split('-')[1]));
        expect(parseInt(battle2.id.split('-')[1])).toBeLessThan(parseInt(battle3.id.split('-')[1]));
    });

    it('stores created battles in the manager', () => {
        const battle = BattleManager.createBattle();
        expect(BattleManager.getBattle(battle.id)).toBe(battle);
    });

    it('returns undefined for non-existent battle', () => {
        expect(BattleManager.getBattle('non-existent')).toBeUndefined();
        expect(BattleManager.getBattle('battle-999')).toBeUndefined();
    });

    it('delegates nextTurn to the battle session', () => {
        const battle = BattleManager.createBattle();
        const originalNextTurn = battle.nextTurn;
        let called = false;
        battle.nextTurn = () => { called = true; };

        BattleManager.nextTurn(battle.id);
        expect(called).toBe(true);
    });

    it('throws error for nextTurn on non-existent battle', () => {
        expect(() => BattleManager.nextTurn('non-existent')).toThrow(/Battle .* not found/);
    });

    it('removes battle from manager', () => {
        const battle = BattleManager.createBattle();
        expect(BattleManager.getBattle(battle.id)).toBeDefined();

        BattleManager.removeBattle(battle.id);
        expect(BattleManager.getBattle(battle.id)).toBeUndefined();
    });

    it('allows retrieving battle after creation', () => {
        const battleId = 'battle-1';
        BattleManager.createBattle();
        const retrieved = BattleManager.getBattle(battleId);
        expect(retrieved).toBeDefined();
        expect(retrieved.id).toBe(battleId);
    });

    it('handles multiple battles independently', () => {
        const battle1 = BattleManager.createBattle();
        const battle2 = BattleManager.createBattle();

        // Verify both battles exist and are different
        expect(BattleManager.getBattle(battle1.id)).toBe(battle1);
        expect(BattleManager.getBattle(battle2.id)).toBe(battle2);
        expect(battle1.id).not.toBe(battle2.id);
    });
});