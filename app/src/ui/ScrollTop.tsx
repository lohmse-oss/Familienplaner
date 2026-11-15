import { useEffect, useState } from 'preact/hooks';
import { Ic } from './icons';

/** Schwebender Knopf „nach oben“ – erscheint beim Herunterscrollen und bringt zu Ansicht-Wahl und Personenfilter zurück. */
export function ScrollTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 450);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  if (!show) return null;
  return (
    <button class="scroll-top" aria-label="Nach oben" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
      <Ic n="up" size={22} sw={2.6} />
    </button>
  );
}
