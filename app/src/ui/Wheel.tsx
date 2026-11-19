import { useEffect, useRef, useState } from 'preact/hooks';
import { haptic } from '../haptics';
import { sheetStack } from './common';
import { Ic, type IconName } from './icons';

export interface WheelItem {
  key: string;
  label: string;
  hint?: string;
  icon: IconName;
}

const ITEM_H = 64; // Höhe eines Eintrags = Fingerweg für einen Schritt
const MAX_SHOWN = 80; // ab diesem Winkel (Grad) ist ein Eintrag unsichtbar „hinten“

/**
 * Auswahlrad „Neuer Eintrag“: die Einträge sitzen auf einer senkrechten Walze, die sich mit dem Finger dreht.
 * Vorne groß und scharf, nach oben/unten kippen sie weg, werden kleiner, blasser und unscharf. Endlos.
 *
 * armed = der Finger liegt noch auf dem Startknopf (Langdruck): Ziehen dreht das Rad, Loslassen nach dem Ziehen öffnet
 * den vorderen Eintrag. Loslassen ohne Ziehen lässt das Rad offen – dann drehen/antippen, daneben tippen schließt.
 */
export function Wheel({ items, start = 0, armed, onPick, onClose }: { items: WheelItem[]; start?: number; armed: boolean; onPick: (key: string) => void; onClose: () => void }) {
  const n = items.length;
  const step = 360 / n;
  const radius = (ITEM_H + 10) / 2 / Math.tan(Math.PI / n); // Walze, auf der die Einträge mit kleinem Abstand sitzen
  const [pos, setPosState] = useState(start); // Position als (Bruch-)Index; 0 = erster Eintrag vorne
  const posRef = useRef(start);
  const tick = useRef(Math.round(start));
  const anim = useRef(0);
  const drag = useRef<{ y: number; p: number; moved: number; t: number; v: number; armed: boolean } | null>(null);
  const [closing, setClosing] = useState(false);
  const [holding, setHolding] = useState(armed); // Finger liegt noch vom Langdruck auf

  const setPos = (p: number) => {
    posRef.current = p;
    setPosState(p);
    const r = Math.round(p);
    if (r !== tick.current) {
      tick.current = r;
      void haptic(); // spürbares Einrasten je Eintrag
    }
  };
  const idx = (p: number) => ((Math.round(p) % n) + n) % n;

  /** Weich auf einen Eintrag einrasten (eigene Animation statt CSS, damit nichts „durch die Mitte“ springt). */
  const snapTo = (target: number, then?: () => void) => {
    cancelAnimationFrame(anim.current);
    const from = posRef.current;
    const t0 = performance.now();
    const dur = Math.min(420, 160 + Math.abs(target - from) * 90);
    const run = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setPos(from + (target - from) * e);
      if (k < 1) anim.current = requestAnimationFrame(run);
      else then?.();
    };
    anim.current = requestAnimationFrame(run);
  };

  const close = () => {
    setClosing(true);
    setTimeout(onClose, 160);
  };
  const pick = (p: number) => {
    void haptic('success');
    onPick(items[idx(p)].key);
  };

  // Android-Zurück schließt das Rad
  useEffect(() => {
    sheetStack.push(close);
    return () => {
      const i = sheetStack.indexOf(close);
      if (i >= 0) sheetStack.splice(i, 1);
      cancelAnimationFrame(anim.current);
    };
  }, []);

  /* ---------- Ziehen (auch während der Finger noch vom Startknopf kommt) ---------- */
  const begin = (y: number, isArmed: boolean) => {
    cancelAnimationFrame(anim.current);
    drag.current = { y, p: posRef.current, moved: 0, t: performance.now(), v: 0, armed: isArmed };
  };
  const move = (y: number) => {
    const d = drag.current;
    if (!d) return;
    const now = performance.now();
    const p = d.p + (d.y - y) / ITEM_H; // Finger nach oben = nächster Eintrag
    d.v = (p - posRef.current) / Math.max(1, now - d.t); // Einträge pro ms
    d.t = now;
    d.moved = Math.max(d.moved, Math.abs(d.y - y));
    setPos(p);
  };
  const end = (tapKey?: 'front' | number) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved < 8) {
      // nur getippt bzw. Langdruck ohne Ziehen losgelassen
      if (tapKey === 'front') pick(posRef.current);
      else if (typeof tapKey === 'number') snapTo(posRef.current + tapKey);
      else snapTo(Math.round(posRef.current));
      return;
    }
    const target = Math.round(posRef.current + Math.max(-2, Math.min(2, d.v * 70))); // etwas Schwung
    if (d.armed) snapTo(Math.round(posRef.current), () => pick(posRef.current)); // Langdruck-Geste: loslassen = öffnen
    else snapTo(target);
  };

  // Langdruck: der Finger liegt noch auf dem Startknopf – Bewegungen kommen über window
  useEffect(() => {
    if (!armed) return;
    let started = false;
    const mv = (e: PointerEvent) => {
      if (!started) {
        started = true;
        begin(e.clientY, true);
      }
      move(e.clientY);
    };
    const up = () => {
      setHolding(false);
      if (started) end();
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return up;
  }, []);

  // Tastatur und Mausrad (Tablet/Browser)
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') snapTo(Math.round(posRef.current) + 1);
    else if (e.key === 'ArrowUp') snapTo(Math.round(posRef.current) - 1);
    else if (e.key === 'Enter' || e.key === ' ') pick(posRef.current);
    else if (e.key === 'Escape') close();
    else return;
    e.preventDefault();
  };
  const wheelAcc = useRef(0);
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    wheelAcc.current += e.deltaY;
    if (Math.abs(wheelAcc.current) >= 40) {
      snapTo(Math.round(posRef.current) + Math.sign(wheelAcc.current));
      wheelAcc.current = 0;
    }
  };

  const front = idx(pos);
  return (
    <div class={`wheel-backdrop ${closing ? 'closing' : ''}`} onClick={close}>
      <div class="wheel-wrap" onClick={(e) => e.stopPropagation()}>
        <div class="wheel-title">Neuer Eintrag</div>
        <div
          class="wheel"
          role="listbox"
          aria-label="Art des neuen Eintrags"
          aria-activedescendant={`wh-${items[front].key}`}
          tabIndex={0}
          ref={(el) => el?.focus({ preventScroll: true })}
          onKeyDown={onKey}
          onWheel={onWheel}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            begin(e.clientY, false);
          }}
          onPointerMove={(e) => drag.current && !drag.current.armed && move(e.clientY)}
          onPointerUp={(e) => {
            if (!drag.current || drag.current.armed) return;
            const hit = (document.elementsFromPoint(e.clientX, e.clientY).find((el) => (el as HTMLElement).dataset?.rel) as HTMLElement | undefined)?.dataset.rel;
            end(hit === undefined ? undefined : Number(hit) === 0 ? 'front' : Number(hit));
          }}
          onPointerCancel={() => end()}
          style={{ height: ITEM_H * 5 }}
        >
          <i class="wheel-band" style={{ height: ITEM_H }} />
          {items.map((it, i) => {
            // nächstgelegene „Kopie“ des Eintrags auf der endlosen Walze
            const j = i + n * Math.round((pos - i) / n);
            const rel = j - pos;
            const a = rel * step;
            if (Math.abs(a) > MAX_SHOWN + step) return null;
            const c = Math.max(0, Math.cos((a * Math.PI) / 180));
            const isFront = Math.abs(rel) < 0.5;
            return (
              <div
                key={it.key}
                id={`wh-${it.key}`}
                role="option"
                aria-selected={isFront}
                data-rel={String(Math.round(rel))}
                class={`wheel-item ${isFront ? 'front' : ''}`}
                style={{
                  height: ITEM_H,
                  transform: `translateY(-50%) translateZ(${-radius}px) rotateX(${-a}deg) translateZ(${radius}px)`,
                  opacity: Math.pow(c, 1.6),
                  filter: c > 0.97 ? 'none' : `blur(${((1 - c) * 3.5).toFixed(2)}px) brightness(${(0.55 + 0.45 * c).toFixed(2)})`,
                  pointerEvents: Math.abs(a) < 60 ? 'auto' : 'none',
                }}
              >
                <span class="wheel-ic"><Ic n={it.icon} size={22} /></span>
                <span class="wheel-txt"><b>{it.label}</b>{it.hint && <small>{it.hint}</small>}</span>
              </div>
            );
          })}
        </div>
        <div class="wheel-hint">{holding ? 'Ziehen zum Drehen · Loslassen öffnet' : 'Drehen und vorne antippen · daneben tippen schließt'}</div>
      </div>
    </div>
  );
}
