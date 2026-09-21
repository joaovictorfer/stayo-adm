import logoAsset from "../../assets/stayo-logo-clara.png.asset.json";

export function PortalBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="inline-flex items-center rounded-md bg-portal-navy px-3 py-2">
      <img src={logoAsset.url} alt="Stayo Gramado" className={compact ? "h-6 w-auto" : "h-7 w-auto"} />
    </div>
  );
}