import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { getKV, setKV } from '../lib/db';
import { IS_SAMPLE, openSampleCampaign } from '../lib/sample';
import { SUPPORT_URL, SUPPORT_PROMPT_AFTER_DAYS, countDay, localDay, type UsageRecord } from '../lib/support';

type Card = 'welcome' | 'support' | null;

/**
 * At most one small, dismissible card in the bottom-left corner, each shown
 * once ever:
 *  - welcome: a fresh install (no party, imports or log) gets pointed at the
 *    sample campaign;
 *  - support: after the app has been opened on SUPPORT_PROMPT_AFTER_DAYS
 *    different days, a single gentle donation ask (only if SUPPORT_URL is set).
 * Never shown inside the sample campaign.
 */
export function CornerCard() {
  const ready = useStore((s) => s.ready);
  const [card, setCard] = useState<Card>(null);

  useEffect(() => {
    if (!ready || IS_SAMPLE) return;
    let cancelled = false;
    void (async () => {
      const usage = countDay(await getKV<UsageRecord>('usage', { days: 0, lastDay: '' }), localDay());
      await setKV('usage', usage);

      const { party, imports, sessionLog } = useStore.getState();
      const fresh = party.length === 0 && imports.length === 0 && sessionLog.length === 0;
      const welcomeDone = await getKV<boolean>('welcomeCardDone', false);
      const supportDone = await getKV<boolean>('supportCardDone', false);

      let next: Card = null;
      if (fresh && !welcomeDone) next = 'welcome';
      else if (SUPPORT_URL && !supportDone && usage.days >= SUPPORT_PROMPT_AFTER_DAYS) next = 'support';
      if (!cancelled) setCard(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  if (!card) return null;

  const done = () => {
    void setKV(card === 'welcome' ? 'welcomeCardDone' : 'supportCardDone', true);
    setCard(null);
  };

  return (
    <div className="corner-card" role="dialog" aria-label={card === 'welcome' ? 'Welcome' : 'Support the app'}>
      <button className="corner-card-close" onClick={done} aria-label="Dismiss" title="Dismiss">
        ✕
      </button>
      {card === 'welcome' ? (
        <>
          <div className="corner-card-title">New here?</div>
          <p className="corner-card-text">
            Look around a sample session first: a fight in progress, a party, notes and encounters. Your own campaign
            stays empty and untouched.
          </p>
          <div className="corner-card-actions">
            <button
              className="btn sm primary"
              onClick={() => {
                done();
                openSampleCampaign();
              }}
            >
              Open the sample campaign
            </button>
            <button className="btn sm ghost" onClick={done}>
              Start fresh
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="corner-card-title">Enjoying Man in the Chair?</div>
          <p className="corner-card-text">
            It’s free, open source and made by one person. If it’s earned a spot behind your screen, you can chip in.
            This is the only time you’ll be asked.
          </p>
          <div className="corner-card-actions">
            <a className="btn sm primary" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" onClick={done}>
              Chip in
            </a>
            <button className="btn sm ghost" onClick={done}>
              No thanks
            </button>
          </div>
        </>
      )}
    </div>
  );
}
