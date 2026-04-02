"use client";

import { useEffect, useRef } from "react";

export function AnimatedGradCap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const chars = "░▒▓█▀▄▌▐│─┤├┴┬╭╮╰╯";
    let time = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const radius = Math.min(rect.width, rect.height) * 0.38;

      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const points: { x: number; y: number; z: number; char: string }[] = [];

      // Both axes spin continuously.
      // X uses a sine curve to linger at neutral (side views) and move
      // quickly through the poles. No flat spots — sin derivative is
      // maximal at zero-crossing so the transition stays smooth.
      const rotY = time * 0.3;
      const rotX = Math.sin(time * 0.15) * 1.3 + 0.15;

      const cosRY = Math.cos(rotY);
      const sinRY = Math.sin(rotY);
      const cosRX = Math.cos(rotX);
      const sinRX = Math.sin(rotX);

      const addPoint = (px: number, py: number, pz: number) => {
        const x1 = px * cosRY - pz * sinRY;
        const z1 = px * sinRY + pz * cosRY;
        const y1 = py * cosRX - z1 * sinRX;
        const finalZ = py * sinRX + z1 * cosRX;

        const depth = (finalZ + 1.5) / 3;
        const charIndex = Math.floor(depth * (chars.length - 1));

        points.push({
          x: centerX + x1 * radius,
          y: centerY + y1 * radius,
          z: finalZ,
          char: chars[Math.max(0, Math.min(chars.length - 1, charIndex))],
        });
      };

      // === MORTARBOARD — single thin surface ===
      const boardSize = 0.9;
      const boardY = -0.15;

      // Top face only — sparse fill for the flat plane
      for (let bx = -boardSize; bx <= boardSize; bx += 0.12) {
        for (let bz = -boardSize; bz <= boardSize; bz += 0.12) {
          addPoint(bx, boardY, bz);
        }
      }

      // Crisp edges (denser than fill to define the square silhouette)
      for (let t = -boardSize; t <= boardSize; t += 0.04) {
        addPoint(t, boardY, -boardSize);
        addPoint(t, boardY, boardSize);
        addPoint(-boardSize, boardY, t);
        addPoint(boardSize, boardY, t);
      }

      // === SKULL CAP — light truncated dome ===
      const capTopRadius = 0.4;
      const capBottomRadius = 0.55;
      const capHeight = 0.35;
      const capTopY = boardY;

      for (let phi = 0; phi < Math.PI * 2; phi += 0.18) {
        for (let t = 0; t <= 1; t += 0.12) {
          const r = capTopRadius + (capBottomRadius - capTopRadius) * t;
          const y = capTopY + capHeight * t;
          addPoint(r * Math.cos(phi + time * 0.5), y, r * Math.sin(phi + time * 0.5));
        }
      }

      // Bottom rim — slightly denser to ground the shape
      for (let phi = 0; phi < Math.PI * 2; phi += 0.1) {
        addPoint(
          capBottomRadius * Math.cos(phi + time * 0.5),
          capTopY + capHeight,
          capBottomRadius * Math.sin(phi + time * 0.5)
        );
      }

      // === BUTTON ===
      for (let phi = 0; phi < Math.PI * 2; phi += 0.5) {
        addPoint(0.05 * Math.cos(phi), boardY - 0.03, 0.05 * Math.sin(phi));
      }

      // === TASSEL — cord across board to corner, then hanging ===
      const cornerX = boardSize * 0.85;
      const cornerZ = boardSize * 0.85;

      // Cord flat on board surface
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        addPoint(t * cornerX, boardY - 0.01, t * cornerZ);
      }

      // Hanging cord with gentle sway that trails the rotation
      const tasselLen = 0.75;
      const swayPhase = time * 0.8;

      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const sway = Math.sin(swayPhase - t * 1.5) * 0.04;
        const hx = cornerX + sway;
        const hz = cornerZ + sway * 0.5;
        const hy = boardY + t * tasselLen;
        addPoint(hx, hy, hz);

        // Fan at the bottom
        if (t > 0.82) {
          const spread = (t - 0.82) * 5;
          for (let a = 0; a < Math.PI * 2; a += 0.6) {
            addPoint(hx + Math.cos(a) * spread * 0.08, hy, hz + Math.sin(a) * spread * 0.08);
          }
        }
      }

      // Sort by z for depth
      points.sort((a, b) => a.z - b.z);

      // Draw with alpha depth — matching sphere style exactly
      points.forEach((point) => {
        const alpha = 0.2 + (point.z + 1.5) * 0.27;
        ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
        ctx.fillText(point.char, point.x, point.y);
      });

      time += 0.035;
      frameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" style={{ display: "block" }} />;
}
