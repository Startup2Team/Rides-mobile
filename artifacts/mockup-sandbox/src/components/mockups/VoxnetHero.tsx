import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const C = {
  bg:        "#040F08",
  bgCard:    "rgba(8, 20, 11, 0.85)",
  gold:      "#F5A623",
  white:     "#EDE8DF",
  dim:       "rgba(237, 232, 223, 0.5)",
  dimMid:    "rgba(237, 232, 223, 0.7)",
  border:    "rgba(245, 166, 35, 0.13)",
  borderMid: "rgba(245, 166, 35, 0.22)",
  glow:      "rgba(245, 166, 35, 0.3)",
  faint:     "rgba(245, 166, 35, 0.06)",
};

// ─── SEED DATA ────────────────────────────────────────────────────────────────
const NAV = ["Services", "About", "Regions", "Contact"];

const STATS = [
  { value: 4,   suffix: "",   label: "Regional Offices" },
  { value: 500, suffix: "MW", label: "Planned Capacity" },
  { value: 24,  suffix: "+",  label: "Projects" },
  { value: 12,  suffix: "+",  label: "Countries" },
];

const SERVICES = [
  "Utility-Scale Solar", "C&I Energy Solutions", "Government PPP",
  "Rural Electrification", "Mining Energy", "Solar Street Lighting",
  "Agricultural Solar", "Healthcare Facilities", "Feasibility Studies",
  "EPC Management", "Supplier Sourcing", "Energy Master Planning",
];

const MARQUEE = [...SERVICES, "🇿🇼 Zimbabwe", "🇿🇦 South Africa", "🇷🇼 Rwanda", "🇨🇳 China"];

// Deterministic "random" particles (seeded so HMR is stable)
const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  x: ((i * 37 + 13) % 97),
  y: ((i * 53 + 7) % 89),
  s: 1 + (i % 3),
  d: 3 + (i % 4),
  delay: (i % 5) * 0.9,
}));

const ENERGY_LINES = Array.from({ length: 6 }, (_, i) => ({
  id: i,
  x1: `${-5 + i * 18}%`,
  y1: "0%",
  x2: `${8 + i * 18}%`,
  y2: "100%",
}));

// ─── FLOATING PARTICLE ────────────────────────────────────────────────────────
function Particle({ x, y, s, d, delay }: { x: number; y: number; s: number; d: number; delay: number }) {
  return (
    <motion.div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: s,
        height: s,
        borderRadius: "50%",
        background: C.gold,
        pointerEvents: "none",
        zIndex: 0,
      }}
      animate={{ opacity: [0, 0.75, 0], y: [0, -50], scale: [0, 1, 0] }}
      transition={{ duration: d, delay, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// ─── STAT CARD WITH COUNTER ───────────────────────────────────────────────────
function StatCard({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  useEffect(() => {
    if (!inView) return;
    const dur = 1800;
    const t0 = performance.now();
    const raf = requestAnimationFrame(function tick(now) {
      const p = Math.min((now - t0) / dur, 1);
      setCount(Math.round((1 - (1 - p) ** 3) * value));
      if (p < 1) requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: "28px 20px",
        borderRadius: 18,
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        backdropFilter: "blur(24px)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Glow accent top */}
      <div style={{
        position: "absolute",
        top: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: 60,
        height: 1,
        background: `linear-gradient(to right, transparent, ${C.gold}, transparent)`,
      }} />

      <div style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 42,
        fontWeight: 800,
        color: C.gold,
        letterSpacing: "-1.5px",
        lineHeight: 1,
      }}>
        {count}{suffix}
      </div>
      <div style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 11,
        fontWeight: 600,
        color: C.dim,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        textAlign: "center",
      }}>
        {label}
      </div>
    </motion.div>
  );
}

// ─── SOLAR ORB (3D animated sun) ─────────────────────────────────────────────
function SolarOrb() {
  return (
    <div style={{
      position: "relative",
      width: 480,
      height: 480,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>

      {/* Outer ambient halo — slow pulse */}
      <motion.div
        style={{
          position: "absolute",
          inset: -60,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(245,166,35,0.09) 0%, transparent 68%)`,
          pointerEvents: "none",
        }}
        animate={{ scale: [1, 1.18, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Secondary halo ring */}
      <motion.div
        style={{
          position: "absolute",
          inset: -20,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(245,166,35,0.04) 0%, transparent 60%)`,
          pointerEvents: "none",
        }}
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
      />

      {/* Outer orbit ring — clockwise */}
      <motion.div
        style={{
          position: "absolute",
          width: 440,
          height: 440,
          borderRadius: "50%",
          border: `1px dashed rgba(245,166,35,0.18)`,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      >
        {/* Bright orbiting node */}
        <div style={{
          position: "absolute",
          top: -5,
          left: "50%",
          marginLeft: -5,
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: C.gold,
          boxShadow: `0 0 14px ${C.gold}, 0 0 30px ${C.glow}`,
        }} />
        {/* Secondary node */}
        <div style={{
          position: "absolute",
          bottom: 20,
          right: 40,
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "rgba(245,166,35,0.45)",
          boxShadow: `0 0 8px ${C.gold}`,
        }} />
      </motion.div>

      {/* Middle orbit ring — counter-clockwise */}
      <motion.div
        style={{
          position: "absolute",
          width: 340,
          height: 340,
          borderRadius: "50%",
          border: `0.5px solid rgba(245,166,35,0.09)`,
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      >
        <div style={{
          position: "absolute",
          top: -3,
          left: "35%",
          marginLeft: -3,
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "rgba(245,166,35,0.6)",
          boxShadow: `0 0 8px ${C.gold}`,
        }} />
        <div style={{
          position: "absolute",
          bottom: 10,
          right: "20%",
          width: 4,
          height: 4,
          borderRadius: "50%",
          background: "rgba(245,166,35,0.35)",
        }} />
      </motion.div>

      {/* 12 animated rays from sphere edge */}
      {Array.from({ length: 12 }, (_, i) => (
        <motion.div
          key={i}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 80,
            height: 1.5,
            marginTop: -0.75,
            background: `linear-gradient(to right, rgba(245,166,35,0.9), transparent)`,
            transformOrigin: "left center",
            transform: `rotate(${i * 30}deg) translateX(120px)`,
          }}
          animate={{
            opacity: [0.1, 1, 0.1],
            scaleX: [0.3, 1, 0.3],
          }}
          transition={{
            duration: 2.8 + (i % 5) * 0.35,
            delay: i * 0.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* 6 secondary shorter rays at offset angles */}
      {Array.from({ length: 6 }, (_, i) => (
        <motion.div
          key={`r2-${i}`}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 40,
            height: 1,
            marginTop: -0.5,
            background: `linear-gradient(to right, rgba(245,166,35,0.5), transparent)`,
            transformOrigin: "left center",
            transform: `rotate(${15 + i * 60}deg) translateX(120px)`,
          }}
          animate={{ opacity: [0.05, 0.6, 0.05] }}
          transition={{
            duration: 3.5 + (i % 3) * 0.6,
            delay: 0.5 + i * 0.25,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* ── Main sphere ──────────────────────────────────────────── */}
      <motion.div
        style={{
          position: "relative",
          width: 240,
          height: 240,
          borderRadius: "50%",
          background: `
            radial-gradient(circle at 30% 25%,
              #FFE080 0%,
              #F5A623 22%,
              #D4820E 48%,
              #8A5200 74%,
              #3E2500 90%,
              #1E1000 100%
            )
          `,
          boxShadow: `
            0 0 60px rgba(245, 166, 35, 0.45),
            0 0 120px rgba(245, 166, 35, 0.18),
            0 0 240px rgba(245, 166, 35, 0.06),
            inset -25px -25px 50px rgba(0, 0, 0, 0.5),
            inset 12px 12px 30px rgba(255, 255, 255, 0.07)
          `,
          zIndex: 2,
        }}
        animate={{ scale: [1, 1.022, 1] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Primary highlight — mimics sphere light source */}
        <div style={{
          position: "absolute",
          top: "10%",
          left: "16%",
          width: 80,
          height: 52,
          borderRadius: "50%",
          background: "rgba(255, 255, 255, 0.24)",
          filter: "blur(16px)",
          transform: "rotate(-12deg)",
        }} />

        {/* Secondary specular reflection */}
        <div style={{
          position: "absolute",
          top: "22%",
          left: "22%",
          width: 28,
          height: 18,
          borderRadius: "50%",
          background: "rgba(255, 255, 255, 0.45)",
          filter: "blur(5px)",
        }} />

        {/* Solar surface bands — horizontal convection lines */}
        {Array.from({ length: 6 }, (_, i) => (
          <motion.div
            key={i}
            style={{
              position: "absolute",
              top: `${18 + i * 11}%`,
              left: "6%",
              right: "6%",
              height: "1px",
              background: `rgba(160, 80, 0, ${0.22 - i * 0.025})`,
              borderRadius: 2,
              transform: `rotate(${(i - 2.5) * 5}deg)`,
            }}
            animate={{ opacity: [0.4, 0.9, 0.4], scaleX: [0.9, 1, 0.9] }}
            transition={{ duration: 4 + i * 0.6, repeat: Infinity, delay: i * 0.4, ease: "easeInOut" }}
          />
        ))}

        {/* Sunspot 1 */}
        <div style={{
          position: "absolute",
          top: "48%",
          left: "54%",
          width: 26,
          height: 18,
          borderRadius: "50%",
          background: "rgba(0, 0, 0, 0.28)",
          filter: "blur(5px)",
        }} />

        {/* Sunspot 2 (smaller) */}
        <div style={{
          position: "absolute",
          top: "32%",
          left: "40%",
          width: 14,
          height: 10,
          borderRadius: "50%",
          background: "rgba(0, 0, 0, 0.18)",
          filter: "blur(3px)",
        }} />

        {/* Limb darkening — edge darkens like real stars */}
        <div style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: "radial-gradient(circle at 50% 50%, transparent 55%, rgba(0,0,0,0.5) 100%)",
        }} />
      </motion.div>

      {/* "Africa" label floating near orb */}
      <motion.div
        style={{
          position: "absolute",
          bottom: 50,
          right: 30,
          padding: "6px 14px",
          borderRadius: 100,
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          backdropFilter: "blur(20px)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 11,
          fontWeight: 600,
          color: C.dim,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      >
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.gold }} />
        4 Regions · Africa-Wide
      </motion.div>

      {/* "Solar energy" floating chip top-left */}
      <motion.div
        style={{
          position: "absolute",
          top: 60,
          left: 20,
          padding: "6px 14px",
          borderRadius: 100,
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          backdropFilter: "blur(20px)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 11,
          fontWeight: 600,
          color: C.dim,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      >
        <motion.div
          style={{ width: 6, height: 6, borderRadius: "50%", background: C.gold }}
          animate={{ scale: [1, 1.6, 1], opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        Solar Energy
      </motion.div>
    </div>
  );
}

// ─── HORIZONTAL MARQUEE ───────────────────────────────────────────────────────
function Marquee() {
  const doubled = [...MARQUEE, ...MARQUEE];
  return (
    <div style={{
      overflow: "hidden",
      borderTop: `1px solid ${C.border}`,
      borderBottom: `1px solid ${C.border}`,
      padding: "15px 0",
      background: C.faint,
    }}>
      <motion.div
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
        style={{ display: "flex", gap: 44, whiteSpace: "nowrap" }}
      >
        {doubled.map((item, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 44 }}>
            <span style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 11,
              fontWeight: 600,
              color: C.dim,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}>
              {item}
            </span>
            <span style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: C.gold,
              display: "inline-block",
              opacity: 0.5,
            }} />
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// ─── MAIN HERO ────────────────────────────────────────────────────────────────
export default function VoxnetHero() {
  const ease = [0.22, 1, 0.36, 1];

  return (
    <div style={{
      fontFamily: "'Space Grotesk', 'Outfit', system-ui, sans-serif",
      background: C.bg,
      color: C.white,
      minHeight: "100vh",
      overflowX: "hidden",
      position: "relative",
    }}>

      {/* ── BACKGROUND GRID ─────────────────────────────────────────── */}
      <div style={{
        position: "fixed",
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(245,166,35,0.022) 1px, transparent 1px),
          linear-gradient(90deg, rgba(245,166,35,0.022) 1px, transparent 1px)
        `,
        backgroundSize: "68px 68px",
        pointerEvents: "none",
        zIndex: 0,
      }} />

      {/* ── ENERGY DIAGONAL LINES (background FX) ───────────────────── */}
      <svg
        style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0, opacity: 0.035 }}
        preserveAspectRatio="none"
      >
        {ENERGY_LINES.map((l) => (
          <motion.line
            key={l.id}
            x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke="#F5A623"
            strokeWidth="0.8"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: [0, 1, 0], opacity: [0, 1, 0] }}
            transition={{
              duration: 6 + l.id * 1.2,
              delay: l.id * 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </svg>

      {/* ── NAV ─────────────────────────────────────────────────────── */}
      <motion.nav
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease }}
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 64px",
          background: "rgba(4, 15, 8, 0.82)",
          backdropFilter: "blur(28px)",
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        {/* Logo mark */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: `linear-gradient(135deg, ${C.gold} 0%, #C47D0E 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 4px 16px rgba(245,166,35,0.35)`,
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="4" fill="#040F08" />
              {Array.from({ length: 8 }, (_, i) => {
                const angle = i * 45 * (Math.PI / 180);
                return (
                  <line
                    key={i}
                    x1={10 + Math.cos(angle) * 5.5}
                    y1={10 + Math.sin(angle) * 5.5}
                    x2={10 + Math.cos(angle) * 8.5}
                    y2={10 + Math.sin(angle) * 8.5}
                    stroke="#040F08"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                );
              })}
            </svg>
          </div>
          <div>
            <div style={{
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: "0.14em",
              color: C.gold,
              lineHeight: 1.1,
            }}>
              VOXNET
            </div>
            <div style={{
              fontSize: 9,
              fontWeight: 500,
              letterSpacing: "0.28em",
              color: C.dim,
              lineHeight: 1,
            }}>
              CONSULTANT
            </div>
          </div>
        </div>

        {/* Nav links */}
        <div style={{ display: "flex", alignItems: "center", gap: 42 }}>
          {NAV.map((link) => (
            <a
              key={link}
              href="#"
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: C.dim,
                letterSpacing: "0.04em",
                textDecoration: "none",
                transition: "color 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.white)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.dim)}
            >
              {link}
            </a>
          ))}
        </div>

        {/* CTA */}
        <motion.button
          whileHover={{ scale: 1.05, boxShadow: `0 0 28px rgba(245,166,35,0.45)` }}
          whileTap={{ scale: 0.97 }}
          style={{
            padding: "10px 26px",
            borderRadius: 100,
            background: C.gold,
            color: "#040F08",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.04em",
            border: "none",
            cursor: "pointer",
            transition: "box-shadow 0.2s ease",
          }}
        >
          Get in Touch
        </motion.button>
      </motion.nav>

      {/* ── HERO BODY ────────────────────────────────────────────────── */}
      <div style={{
        position: "relative",
        zIndex: 1,
        display: "grid",
        gridTemplateColumns: "1.1fr 0.9fr",
        gap: 60,
        padding: "88px 64px 56px",
        minHeight: "calc(100vh - 80px)",
        alignItems: "center",
      }}>

        {/* ── LEFT: Text Content ──────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>

          {/* Badge pill */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 16px",
              borderRadius: 100,
              border: `1px solid ${C.borderMid}`,
              background: C.faint,
              width: "fit-content",
            }}
          >
            <motion.div
              style={{ width: 7, height: 7, borderRadius: "50%", background: C.gold }}
              animate={{ scale: [1, 1.7, 1], opacity: [1, 0.45, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: C.gold,
              textTransform: "uppercase",
            }}>
              Africa's Renewable Energy Partner
            </span>
          </motion.div>

          {/* H1 */}
          <motion.h1
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.28, ease }}
            style={{
              margin: 0,
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1.01,
              letterSpacing: "-2.5px",
              color: C.white,
            }}
          >
            Powering<br />
            Africa's<br />
            <span style={{ color: C.gold }}>Renewable</span><br />
            <span style={{ fontSize: 68 }}>Energy Future</span>
          </motion.h1>

          {/* Sub-heading */}
          <motion.p
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45, ease }}
            style={{
              margin: 0,
              fontSize: 16,
              lineHeight: 1.75,
              color: C.dimMid,
              maxWidth: 460,
            }}
          >
            Leading renewable energy consulting across Africa — from utility-scale solar
            and government infrastructure to commercial, industrial, and agricultural energy solutions.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.58, ease }}
            style={{ display: "flex", gap: 14, alignItems: "center" }}
          >
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: `0 0 36px rgba(245,166,35,0.5)` }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: "15px 34px",
                borderRadius: 100,
                background: C.gold,
                color: "#040F08",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.02em",
                border: "none",
                cursor: "pointer",
              }}
            >
              Explore Services →
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05, borderColor: C.gold, color: C.white }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: "15px 34px",
                borderRadius: 100,
                background: "transparent",
                color: C.dimMid,
                fontSize: 14,
                fontWeight: 500,
                letterSpacing: "0.02em",
                border: `1px solid ${C.border}`,
                cursor: "pointer",
                transition: "border-color 0.2s, color 0.2s",
              }}
            >
              View Projects
            </motion.button>
          </motion.div>

          {/* Divider */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.9, delay: 0.72, ease }}
            style={{
              height: "1px",
              background: `linear-gradient(90deg, ${C.border}, transparent)`,
              transformOrigin: "left",
            }}
          />

          {/* Regional presence flags */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.85, ease }}
            style={{ display: "flex", gap: 24, alignItems: "center" }}
          >
            <span style={{ fontSize: 11, color: C.dim, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Operating in
            </span>
            {[
              { flag: "🇿🇼", name: "Zimbabwe" },
              { flag: "🇿🇦", name: "South Africa" },
              { flag: "🇷🇼", name: "Rwanda" },
              { flag: "🇨🇳", name: "China" },
            ].map((r) => (
              <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.dimMid, fontWeight: 500 }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>{r.flag}</span>
                <span>{r.name}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ── RIGHT: Solar Visual ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.82, x: 40 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 1.1, delay: 0.32, ease }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {/* Floating particle field behind orb */}
          <div style={{ position: "absolute", inset: -60, overflow: "hidden", borderRadius: 32 }}>
            {PARTICLES.map((p) => (
              <Particle key={p.id} {...p} />
            ))}
          </div>

          {/* Solar orb */}
          <SolarOrb />
        </motion.div>
      </div>

      {/* ── STATS ROW ────────────────────────────────────────────────── */}
      <div style={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        gap: 16,
        padding: "0 64px 64px",
      }}>
        {STATS.map((s) => (
          <StatCard key={s.label} value={s.value} suffix={s.suffix} label={s.label} />
        ))}
      </div>

      {/* ── MARQUEE ──────────────────────────────────────────────────── */}
      <Marquee />
    </div>
  );
}
