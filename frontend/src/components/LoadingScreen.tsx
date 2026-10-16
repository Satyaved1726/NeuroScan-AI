export default function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-medical-mist">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center">
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-medical-blue border-r-medical-blue animate-spin"></div>
          </div>
        </div>
        <div className="text-center">
          <p className="font-[Manrope] text-lg font-semibold text-medical-ink">Loading</p>
          <p className="text-sm text-slate-500">Please wait a moment...</p>
        </div>
      </div>
    </div>
  );
}
