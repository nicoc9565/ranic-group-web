export function Logo({
  variant = "light",
}: {
  variant?: "light" | "dark";
}) {
  const dark = variant === "dark";
  const wordmark = dark ? "text-[#F1EBDA]" : "text-olive-deep";
  const accent = dark ? "text-[#F1EBDA]" : "text-olive";
  return (
    <span
      aria-label="RANIC GROUP LLC"
      className={`font-league text-2xl font-extrabold leading-none tracking-[-0.055em] ${wordmark}`}
    >
      ranic group<span className={accent}>.</span>
      <span className={`ml-0.5 align-super text-[0.42em] font-bold ${accent}`}>
        LLC
      </span>
    </span>
  );
}
