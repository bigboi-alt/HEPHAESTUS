/**
 * CEDALION BUDDY — a tiny bobble-head figure who sits on top of the chat.
 *
 * Pure SVG + CSS keyframes: breathes while idle, bobs his head, blinks now
 * and then. When the chat opens he gets bumped into the air and lands back
 * down on his seat; when it closes he drops and settles. Zero JS animation,
 * zero libraries — three keyframes and a transform. Respects the global
 * motion-off setting automatically (index.css kills animations then).
 */

export type BuddyMode = "idle" | "hop" | "fall";

export default function CedalionBuddy({ mode = "idle", size = 52 }: { mode?: BuddyMode; size?: number }) {
  const anim = mode === "hop" ? "cb-hop" : mode === "fall" ? "cb-fall" : "";
  return (
    <span className={`cb ${anim}`} style={{ width: size, height: Math.round(size * 0.92) }} aria-hidden="true">
      <svg viewBox="0 0 56 52" width={size} height={Math.round(size * 0.92)}>
        <g className="cb-breath">
          {/* soft shadow under the seat */}
          <ellipse cx="28" cy="47.5" rx="15" ry="2.4" fill="#000" opacity="0.12" />
          {/* body — small, seated, round belly */}
          <path
            d="M14.5 31.5h27a4 4 0 0 1 4 4.2c-.2 5.6-4.4 9.3-10.5 9.3h-14c-6.1 0-10.3-3.7-10.5-9.3a4 4 0 0 1 4-4.2z"
            fill="#f6e8cd" stroke="#22190e" strokeWidth="2.2" strokeLinejoin="round"
          />
          {/* feet peeking out */}
          <rect x="19" y="44" width="6" height="4.4" rx="2" fill="#22190e" />
          <rect x="31" y="44" width="6" height="4.4" rx="2" fill="#22190e" />
          {/* pointing arm (right) — the guide, pointing the way up */}
          <path d="M41.5 31.5c2 .3 3.6 0 5.2-1.6 1.2-1.2 1.8-2.6 2.1-4.4" fill="none" stroke="#22190e" strokeWidth="3.1" strokeLinecap="round" />
          <circle cx="49.6" cy="23.2" r="3.1" fill="#c4562a" stroke="#22190e" strokeWidth="1.7" />
          {/* scarf — dusted orange, the brand voice */}
          <path d="M15 29.4c4.6-1.1 9-1.2 12.4-.6 3.6.6 7.6 1.2 11.1.9 1.6-.1 2.9 1 2.9 2.4v1.3c0 1.5-1.4 2.5-2.9 2.2-4-.8-7.4-1-11-1-4-.1-8.3 0-12.4.6-1.6.2-3.1-1-3.1-2.5v-1.2c0-1.5 1.3-2.6 3-2.1z" fill="#c4562a" />
          {/* left stub arm */}
          <path d="M14 33.5c-2.6 1.4-4.4 3.4-5.2 6" fill="none" stroke="#22190e" strokeWidth="3" strokeLinecap="round" />
          <circle cx="8.6" cy="40.6" r="3" fill="#22190e" />

          {/* bobble head group — the head is the whole personality */}
          <g className="cb-bob">
            <circle cx="28" cy="15.5" r="12.6" fill="#f9edd6" stroke="#22190e" strokeWidth="2.2" />
            {/* hair tuft */}
            <path d="M23 4.5c0-2.5 2.2-4.2 4.8-3.6 1.6.4 2.6 1.6 3.4 3.1-2.4-.6-4.6-.2-8.2.5z" fill="#22190e" />
            {/* cheeks */}
            <circle cx="20.6" cy="19.4" r="1.9" fill="#efb39a" opacity="0.75" />
            <circle cx="35.4" cy="19.4" r="1.9" fill="#efb39a" opacity="0.75" />
            {/* eyes */}
            <g className="cb-eye"><circle cx="23.2" cy="15.6" r="1.7" fill="#22190e" /></g>
            <g className="cb-eye"><circle cx="32.8" cy="15.6" r="1.7" fill="#22190e" /></g>
            {/* gentle smile */}
            <path d="M24.4 21.4c1.1 1.3 2.4 1.9 3.6 1.9s2.5-.6 3.6-1.9" fill="none" stroke="#22190e" strokeWidth="1.7" strokeLinecap="round" />
          </g>
        </g>
      </svg>
    </span>
  );
}
