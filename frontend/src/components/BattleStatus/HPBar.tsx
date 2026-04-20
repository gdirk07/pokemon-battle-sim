export function HPBar({ hp, maxHp }: { hp: number | undefined; maxHp: number | undefined }) {
    const safeHp = hp ?? 0;
    const safeMaxHp = maxHp ?? 0
    const pct    = safeMaxHp > 0 ? Math.round((safeHp / safeMaxHp) * 100) : 0
    const color  = pct > 50 ? 'bg-green-500' : pct > 20 ? 'bg-yellow-400' : 'bg-red-500'
    return (
        <div>
            <div className="bg-gray-700 rounded-full h-1.5 overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${color}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    )
}