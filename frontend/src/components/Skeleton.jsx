/**
 * Skeleton loading components for LiquidityIQ.
 * Each skeleton mirrors the exact geometry of its real counterpart
 * so the layout doesn't shift when data arrives.
 */

/** Base shimmer bar — the atomic building block. */
export function Bone({ className = "" }) {
  return (
    <span
      className={`block rounded-md bg-slate-200/70 shimmer ${className}`}
      aria-hidden="true"
    />
  );
}

/** Matches the KPI cards on the Dashboard (Total Cash, Receivables, etc.) */
export function KpiSkeleton() {
  return (
    <div className="card-flat p-5 relative overflow-hidden">
      <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-sky-50 opacity-70" />
      <div className="relative flex items-center justify-between">
        <Bone className="h-3 w-24" />
        <Bone className="h-4 w-4 rounded-full" />
      </div>
      <Bone className="relative mt-4 h-8 w-36" />
      <Bone className="relative mt-2 h-3 w-28" />
    </div>
  );
}

/** Matches a single entity row in the Dashboard table. */
export function EntityRowSkeleton() {
  return (
    <tr className="border-b hairline">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <Bone className="h-8 w-8 rounded-lg shrink-0" />
          <div>
            <Bone className="h-4 w-32" />
            <Bone className="mt-1 h-3 w-20" />
          </div>
        </div>
      </td>
      <td className="px-6 py-4 hidden sm:table-cell"><Bone className="h-3 w-14" /></td>
      <td className="px-6 py-4 hidden md:table-cell"><Bone className="h-3 w-20" /></td>
      <td className="px-6 py-4 text-right"><Bone className="h-4 w-20 ml-auto" /></td>
      <td className="px-6 py-4 text-right hidden sm:table-cell"><Bone className="h-3 w-12 ml-auto" /></td>
      <td className="px-6 py-4"><Bone className="h-5 w-16 rounded-full" /></td>
      <td className="px-6 py-4 text-right"><Bone className="h-3 w-14 ml-auto" /></td>
    </tr>
  );
}

/** Chart placeholder with axes hint. */
export function ChartSkeleton({ className = "h-72" }) {
  return (
    <div className={`${className} rounded-lg border border-slate-200/50 bg-slate-50/50 flex flex-col justify-end p-4 gap-2 overflow-hidden`}>
      <div className="flex-1 flex items-end gap-1.5">
        {Array.from({ length: 24 }, (_, i) => (
          <div
            key={i}
            className="flex-1 bg-sky-100 rounded-t shimmer"
            style={{ height: `${20 + Math.sin(i * 0.5) * 30 + Math.random() * 25}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between pt-2 border-t border-slate-200/50">
        {Array.from({ length: 6 }, (_, i) => (
          <Bone key={i} className="h-2 w-8" />
        ))}
      </div>
    </div>
  );
}

/** Matches entity cards in the Entities grid. */
export function EntityCardSkeleton() {
  return (
    <div className="card-flat rounded-lg p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Bone className="h-11 w-11 rounded-xl shrink-0" />
          <div>
            <Bone className="h-4 w-32" />
            <Bone className="mt-1 h-3 w-20" />
          </div>
        </div>
        <Bone className="h-5 w-14 rounded-full" />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        {[1, 2, 3].map(i => (
          <div key={i}>
            <Bone className="h-2 w-10" />
            <Bone className="mt-1 h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between">
        <Bone className="h-3 w-16" />
      </div>
    </div>
  );
}

/** Matches the risk doughnut card. */
export function DoughnutSkeleton() {
  return (
    <div className="card-flat p-6">
      <Bone className="h-3 w-28 mb-4" />
      <div className="h-48 flex items-center justify-center">
        <div className="h-36 w-36 rounded-full border-[14px] border-slate-200/50 shimmer" />
      </div>
      <div className="mt-4 space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bone className="h-2 w-2 rounded-full" />
              <Bone className="h-3 w-16" />
            </div>
            <Bone className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Matches a watchlist item in the dashboard. */
export function WatchlistItemSkeleton() {
  return (
    <div className="border border-slate-200/70 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <Bone className="h-3 w-16" />
          <Bone className="mt-1 h-3 w-12" />
        </div>
        <div className="text-right">
          <Bone className="h-4 w-16 ml-auto" />
          <Bone className="mt-1 h-3 w-12 ml-auto" />
        </div>
      </div>
    </div>
  );
}

/** Full Dashboard skeleton — composites all above. */
export function DashboardSkeleton() {
  return (
    <div className="px-5 sm:px-8 py-8 max-w-[1500px]">
      <div className="mb-8">
        <Bone className="h-3 w-28" />
        <Bone className="mt-3 h-9 w-72" />
        <Bone className="mt-2 h-4 w-64" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map(i => <KpiSkeleton key={i} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <DoughnutSkeleton />
        <div className="card-flat p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <Bone className="h-3 w-36" />
            <Bone className="h-3 w-20" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => <WatchlistItemSkeleton key={i} />)}
          </div>
        </div>
      </div>

      <div className="card-flat rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b hairline flex items-center gap-2">
          <Bone className="h-4 w-4 rounded" />
          <Bone className="h-3 w-36" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b hairline">
                <th className="px-6 py-3 text-left"><Bone className="h-2 w-12" /></th>
                <th className="px-6 py-3 text-left hidden sm:table-cell"><Bone className="h-2 w-10" /></th>
                <th className="px-6 py-3 text-left hidden md:table-cell"><Bone className="h-2 w-12" /></th>
                <th className="px-6 py-3 text-right"><Bone className="h-2 w-16 ml-auto" /></th>
                <th className="px-6 py-3 text-right hidden sm:table-cell"><Bone className="h-2 w-12 ml-auto" /></th>
                <th className="px-6 py-3 text-left"><Bone className="h-2 w-20" /></th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map(i => <EntityRowSkeleton key={i} />)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
