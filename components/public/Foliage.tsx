// Follaje ilustrado en SVG puro — la firma visual del sitio público v4.
// Sin imágenes: hojas sólidas con nervaduras, en capas de tonos oliva/sage/gold,
// pensadas para desbordar desde una esquina (el padre lleva overflow-hidden).

const LEAF_PATH = "M30 120C-8 78 4 26 30 0C56 26 68 78 30 120Z";

function Leaf({
  fill,
  transform,
  opacity = 1,
}: {
  fill: string;
  transform: string;
  opacity?: number;
}) {
  return (
    <g transform={transform} opacity={opacity}>
      <path d={LEAF_PATH} fill={fill} />
      <path
        d="M30 112V10"
        fill="none"
        stroke="rgba(15,20,6,0.22)"
        strokeWidth="2"
      />
      <path
        d="M30 34L14 52M30 34L46 52M30 62L12 82M30 62L48 82"
        fill="none"
        stroke="rgba(15,20,6,0.14)"
        strokeWidth="1.6"
      />
    </g>
  );
}

/** Arreglo grande para el hero: ~7 hojas desbordando desde la esquina superior derecha. */
export function Foliage({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 420 380"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <Leaf fill="#31420F" transform="translate(330 30) rotate(148) scale(2.6)" />
      <Leaf fill="#4E6A2A" transform="translate(392 130) rotate(195) scale(2.1)" />
      <Leaf fill="#6C8340" transform="translate(295 95) rotate(120) scale(1.75)" />
      <Leaf fill="#8CA06A" transform="translate(370 235) rotate(230) scale(1.45)" />
      <Leaf fill="#C7A662" transform="translate(258 175) rotate(95) scale(1.1)" />
      <Leaf fill="#4E6A2A" transform="translate(322 300) rotate(262) scale(1.3)" />
      <Leaf fill="#8CA06A" transform="translate(240 285) rotate(75) scale(0.85)" opacity={0.9} />
    </svg>
  );
}

/** Acento mínimo (2 hojas) para banda MAP y footer. */
export function FoliageAccent({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 180"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <Leaf fill="#8CA06A" transform="translate(150 20) rotate(160) scale(1.5)" opacity={0.35} />
      <Leaf fill="#6C8340" transform="translate(115 90) rotate(115) scale(1.0)" opacity={0.3} />
    </svg>
  );
}

/** Hoja individual chica, para chips/íconos de tarjetas. */
export function LeafIcon({
  className,
  fill = "#556B2F",
}: {
  className?: string;
  fill?: string;
}) {
  return (
    <svg viewBox="0 0 60 120" className={className} aria-hidden="true" focusable="false">
      <path d={LEAF_PATH} fill={fill} />
      <path d="M30 112V10" fill="none" stroke="rgba(15,20,6,0.22)" strokeWidth="3" />
    </svg>
  );
}
