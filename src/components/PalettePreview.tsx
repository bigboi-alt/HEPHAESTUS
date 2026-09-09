import { useState } from "react";
import { readableOn } from "../engine/color";
import type { Palette, Role } from "../engine/akmon";

type Variant = "landing" | "dashboard" | "commerce";

const VARIANTS: { id: Variant; label: string }[] = [
  { id: "landing", label: "landing" },
  { id: "dashboard", label: "dashboard" },
  { id: "commerce", label: "commerce" },
];

/** The palette applied to a real interface — where palettes actually fail. */
export default function PalettePreview({ p }: { p: Palette }) {
  const [variant, setVariant] = useState<Variant>("landing");
  const c = (r: Role) => p.swatches.find((s) => s.role === r)!.hex;

  const shell: React.CSSProperties = {
    background: c("background"),
    color: c("text"),
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    padding: 18,
    minHeight: 320,
    letterSpacing: 0,
    lineHeight: 1.5,
  };
  const card: React.CSSProperties = {
    background: c("surface"),
    border: `1px solid ${c("border")}`,
    borderRadius: 8,
    padding: 14,
  };
  const btn: React.CSSProperties = {
    background: c("primary"),
    color: readableOn(c("primary")),
    borderRadius: 6,
    padding: "8px 16px",
    fontSize: 12,
    fontWeight: 600,
    border: "none",
    display: "inline-block",
  };
  const ghost: React.CSSProperties = {
    border: `1px solid ${c("border")}`,
    color: c("text"),
    borderRadius: 6,
    padding: "8px 16px",
    fontSize: 12,
    display: "inline-block",
  };

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <span className="label">live preview</span>
        <div className="row gap-1">
          {VARIANTS.map((v) => (
            <button
              key={v.id}
              className="btn"
              data-active={variant === v.id}
              style={{ padding: "4px 10px", fontSize: 10 }}
              onClick={() => setVariant(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ border: "1px solid var(--line)", overflow: "hidden" }}>
        <div style={shell}>
          {/* chrome */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, background: c("primary") }} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Northwind</span>
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 11, color: c("muted") }}>
              <span>Product</span><span>Pricing</span><span>Docs</span>
              <span style={{ ...btn, padding: "6px 12px", fontSize: 11 }}>Start free</span>
            </div>
          </div>

          {variant === "landing" && (
            <>
              <div style={{ maxWidth: 460, marginBottom: 18 }}>
                <div style={{ fontSize: 11, color: c("accent"), fontWeight: 600, letterSpacing: "0.08em", marginBottom: 8 }}>
                  NOW IN PUBLIC BETA
                </div>
                <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.12, letterSpacing: "-0.02em", marginBottom: 10 }}>
                  Ship the interface, not the argument about it.
                </div>
                <div style={{ fontSize: 13, color: c("muted"), marginBottom: 16 }}>
                  One system for colour, layout and review. Your team stops debating hex codes and starts shipping.
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <span style={btn}>Get started</span>
                  <span style={ghost}>Read the docs</span>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
                <div style={{ ...card, gridRow: "span 1" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Realtime tokens</div>
                  <div style={{ fontSize: 11, color: c("muted") }}>Every surface updates the moment a value changes.</div>
                </div>
                <div style={card}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: c("accent") }}>99.9%</div>
                  <div style={{ fontSize: 10, color: c("muted") }}>uptime</div>
                </div>
                <div style={card}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: c("secondary") }}>4.2k</div>
                  <div style={{ fontSize: 10, color: c("muted") }}>teams</div>
                </div>
              </div>
            </>
          )}

          {variant === "dashboard" && (
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {["Overview", "Revenue", "Customers", "Reports", "Settings"].map((x, i) => (
                  <div
                    key={x}
                    style={{
                      fontSize: 11,
                      padding: "7px 10px",
                      borderRadius: 6,
                      background: i === 1 ? c("surface") : "transparent",
                      color: i === 1 ? c("text") : c("muted"),
                      borderLeft: i === 1 ? `2px solid ${c("primary")}` : "2px solid transparent",
                    }}
                  >
                    {x}
                  </div>
                ))}
              </div>
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 12 }}>
                  {[
                    ["MRR", "$48,210", "+12.4%", c("primary")],
                    ["Active", "1,284", "+3.1%", c("secondary")],
                    ["Churn", "1.8%", "−0.4%", c("accent")],
                  ].map(([k, v, d, col]) => (
                    <div key={k as string} style={card}>
                      <div style={{ fontSize: 10, color: c("muted"), textTransform: "uppercase", letterSpacing: "0.08em" }}>{k}</div>
                      <div style={{ fontSize: 19, fontWeight: 700, margin: "3px 0" }}>{v}</div>
                      <div style={{ fontSize: 10, color: col as string }}>{d}</div>
                    </div>
                  ))}
                </div>
                <div style={{ ...card, padding: 14 }}>
                  <div style={{ fontSize: 11, color: c("muted"), marginBottom: 10 }}>Revenue, last 12 weeks</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 70 }}>
                    {[42, 55, 38, 64, 71, 48, 82, 59, 90, 74, 96, 88].map((h, i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          height: `${h}%`,
                          background: i === 10 ? c("accent") : c("primary"),
                          opacity: i === 10 ? 1 : 0.55,
                          borderRadius: "3px 3px 0 0",
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {variant === "commerce" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 12 }}>
                {["Field Jacket", "Wool Scarf", "Canvas Tote"].map((name, i) => (
                  <div key={name} style={{ ...card, padding: 0, overflow: "hidden" }}>
                    <div
                      style={{
                        height: 76,
                        background: [c("primary"), c("secondary"), c("accent")][i],
                        opacity: 0.9,
                      }}
                    />
                    <div style={{ padding: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{name}</div>
                      <div style={{ fontSize: 11, color: c("muted"), marginBottom: 8 }}>
                        ${[128, 64, 42][i]}.00
                      </div>
                      <div style={{ ...btn, width: "100%", textAlign: "center", padding: "6px 0", fontSize: 11 }}>
                        Add to bag
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>Free shipping over $75</div>
                  <div style={{ fontSize: 11, color: c("muted") }}>Delivered in 2–4 working days</div>
                </div>
                <span style={{ ...btn, background: c("accent"), color: readableOn(c("accent")) }}>Checkout</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
