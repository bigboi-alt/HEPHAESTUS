/**
 * The founder's key, watched app-wide.
 *
 * One listener, on the window, that keeps a short rolling buffer of what has been typed and compares
 * its tail against the key. It never reads the field a person is typing into, never stores anything,
 * and does nothing at all until the sequence is complete — so typing in a prompt box or a rename field
 * behaves exactly as it did before.
 */
import { useEffect } from "react";
import { keyMatches } from "../engine/identity";
import { useApp } from "../store";

export function useKeystone(): void {
  const unlock = useApp((s) => s.unlockFounder);

  useEffect(() => {
    let buf = "";
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length !== 1) return; // no shortcuts, no navigation keys
      buf = (buf + e.key).slice(-64);
      if (keyMatches(buf)) {
        buf = "";
        unlock();
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text") ?? "";
      if (keyMatches(text)) {
        unlock();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
  }, [unlock]);
}
