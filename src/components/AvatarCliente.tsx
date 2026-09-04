/**
 * Il volto della cliente, ovunque nel gestionale.
 *
 * Se dall'app ha caricato la foto del profilo si vede quella; altrimenti
 * un pallino colorato con le iniziali. Il colore non è a caso: nasce dal
 * nome, così Maria è sempre dello stesso colore in anagrafica, in chat e
 * dovunque comparirà — l'occhio impara a riconoscerla prima di leggere.
 */

/* eslint-disable @next/next/no-img-element */

const TAVOLOZZA = [
  '#B59B53', // l'oro di casa
  '#8A7639',
  '#54704F', // salvia
  '#7A4A63', // prugna
  '#A6432E', // terracotta
  '#C2762F', // rame
  '#3D6B7D', // petrolio
  '#6B5B8A', // lavanda scura
];

function coloreDaNome(nome: string): string {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0;
  return TAVOLOZZA[h % TAVOLOZZA.length];
}

export function inizialiDi(nome: string): string {
  const parti = nome.trim().split(/\s+/);
  return `${parti[0]?.[0] ?? ''}${parti[1]?.[0] ?? ''}`.toUpperCase() || '?';
}

export default function AvatarCliente({
  nome,
  avatar,
  size = 40,
  className = '',
}: {
  nome: string;
  avatar?: string | null;
  size?: number;
  className?: string;
}) {
  if (avatar) {
    return (
      <img
        src={avatar}
        alt={nome}
        width={size}
        height={size}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${className}`}
      style={{ width: size, height: size, background: coloreDaNome(nome), fontSize: size * 0.36 }}
    >
      {inizialiDi(nome)}
    </div>
  );
}
