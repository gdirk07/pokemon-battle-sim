interface Props {
    p1Total: number,
    p2Total: number,
    isOpen: boolean,
};

export function Betting({p1Total, p2Total, isOpen = false}: Props) {
    const total = p1Total + p2Total;
    const p1Odds = p1Total > 0 ? (total / p1Total).toFixed(2) : '?';
    const p2Odds = p2Total > 0 ? (total / p2Total).toFixed(2) : '?';
    
    return (
        <div className="flex items-center justify-between px-3 bg-black/40 border-b border-white/10">
            {/* P1 side */}
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-blue-400">
                    {p1Total.toLocaleString()} pts
                </span>
                {total > 0 && (
                    <span className="text-[9px] text-gray-400">{p1Odds}x</span>
                )}
            </div>

            {/* Center — betting status */}
            <div className="flex flex-col items-center">
                {isOpen ? (
                    <span className="text-[9px] font-bold text-green-400 uppercase tracking-widest animate-pulse">
                        Betting open
                    </span>
                ) : (
                    <span className="text-[9px] text-red-500 uppercase tracking-widest">
                        Betting closed
                    </span>
                )}
            </div>

            {/* P2 side */}
            <div className="flex items-center gap-2">
                {total > 0 && (
                    <span className="text-[9px] text-gray-400">{p2Odds}x</span>
                )}
                <span className="text-[10px] font-bold text-red-400">
                    {p2Total.toLocaleString()} pts
                </span>
            </div>
        </div>
    )
}