import { test, expect, waitForOverlay } from './fixtures';

test.describe('overlay + backend with fake Streamer.bot', () => {
    test('a full battle from start to finish', async ({ page, request, streamerbot: sb}) => {
        test.setTimeout(240_000);
        sb.autoAdvance = true;

        await page.goto('/');
        await waitForOverlay(request);

        sb.fire('PB_START_BATTLE');

        const announce = await sb.waitForAction('PB_ANNOUNCE_CONTESTANTS');
        expect(announce.args.player1).toBeTruthy();
        await expect(page.getByText('Random Battle')).toBeVisible();
        await expect(page.getByText('VS', { exact: true })).toBeVisible();
        await expect(page.getByText(/Betting closes in \d+s/)).toBeVisible();

        await sb.waitForAction('PB_BATTLE_STARTING');
        await expect(page.getByText(/^Turn \d+$/)).toBeVisible();

        const ended = await sb.waitForAction('PB_BATTLE_ENDED', 220_000);
        expect(['player1', 'player2']).toContain(ended.args.winner);

        await expect(page.getByText('WINNER!')).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText(/Battle lasted \d+ turns?/)).toBeVisible();
    });

    test('reloading the overlay mid-battle recovers and the battle still finishes', async ({ page, request, streamerbot: sb }) => {
        test.setTimeout(240_000);
        sb.autoAdvance = true;

        await page.goto('/');
        await waitForOverlay(request);
        sb.fire('PB_START_BATTLE');
        await sb.waitForAction('PB_BATTLE_STARTING');
        await expect(page.getByText(/^Turn \d+$/)).toBeVisible();

        await page.reload();
        await waitForOverlay(request);
        await expect(page.getByText(/^Turn \d+$/)).toBeVisible();

        await sb.waitForAction('PB_BATTLE_ENDED', 220_000);
        expect(sb.names().filter((n) => n === 'PB_BATTLE_ENDED')).toHaveLength(1);
        await expect(page.getByText('WINNER!')).toBeVisible({ timeout: 15_000 });
    });
});