export function Footer() {
  return (
    <footer className="mt-8 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>
          ClearBreath · Atmospheric data via Open-Meteo Air Quality &amp; Weather · US EPA PM2.5 AQI breakpoints
        </p>
        <p>
          Household preferences stay locally in your browser. Not a substitute for urgent medical care.
        </p>
      </div>
    </footer>
  );
}
