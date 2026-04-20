export function StatusDot({ status }: { status: string }) {
    const colors: Record<string, string> = {
        brn: 'bg-orange-500',
        slp: 'bg-gray-400',
        par: 'bg-yellow-400',
        psn: 'bg-purple-500',
        tox: 'bg-purple-700',
        frz: 'bg-blue-300',
        fnt: 'bg-red-500',
    }
    const labels: Record<string, string> = {
        brn: 'BRN', slp: 'SLP', par: 'PAR',
        psn: 'PSN', tox: 'TOX', frz: 'FRZ', fnt: 'FNT',
    }
    const color = colors[status] ?? 'bg-gray-400'
    return (
        <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 rounded-full text-white ${color}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-white opacity-60 inline-block" />
            {labels[status] ?? status.toUpperCase()}
        </span>
    )
}