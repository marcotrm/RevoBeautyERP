'use client';

/**
 * Il riquadro della firma: dito o pennino, niente mouse necessario.
 *
 * Stava dentro la pagina del consenso laser; adesso lo usano in due — quella
 * pagina e la postazione del tablet — e una firma disegnata in due modi
 * diversi sarebbe la cosa piu' facile da far divergere senza accorgersene.
 *
 * La tela si disegna alla risoluzione vera dello schermo: senza, la firma
 * esce sgranata proprio sul tablet, che e' l'unico posto dove si usa davvero.
 */

import React, { useEffect, useRef } from 'react';

export default function FirmaGrafica({
  onChange,
  className = 'w-full h-44 rounded-2xl bg-white border-2 border-dashed border-gray-300 touch-none',
  etichettaCancella = 'Cancella e rifai la firma',
}: {
  onChange: (dato: string | null) => void;
  className?: string;
  etichettaCancella?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const giu = useRef(false);
  const scritto = useRef(false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const scala = window.devicePixelRatio || 1;
    const r = c.getBoundingClientRect();
    c.width = r.width * scala;
    c.height = r.height * scala;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(scala, scala);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
  }, []);

  const punto = (e: React.PointerEvent) => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div>
      <canvas
        ref={ref}
        onPointerDown={e => {
          e.currentTarget.setPointerCapture(e.pointerId);
          giu.current = true; scritto.current = true;
          const ctx = ref.current!.getContext('2d')!;
          const p = punto(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
        }}
        onPointerMove={e => {
          if (!giu.current) return;
          const ctx = ref.current!.getContext('2d')!;
          const p = punto(e); ctx.lineTo(p.x, p.y); ctx.stroke();
        }}
        onPointerUp={() => {
          if (!giu.current) return;
          giu.current = false;
          if (scritto.current) onChange(ref.current!.toDataURL('image/png'));
        }}
        onPointerLeave={() => { giu.current = false; }}
        className={className}
        style={{ touchAction: 'none' }}
      />
      <button
        type="button"
        onClick={() => {
          const c = ref.current!;
          c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
          scritto.current = false;
          onChange(null);
        }}
        className="mt-2 text-sm font-medium text-gray-500 underline"
      >
        {etichettaCancella}
      </button>
    </div>
  );
}
