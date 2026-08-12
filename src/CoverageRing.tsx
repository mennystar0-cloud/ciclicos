export const CoverageRing = ({ pct, size = 80 }: { pct: number; size?: number }) => {
    const r = (size / 2) - 8;
    const circ = 2 * Math.PI * r;
    const dash = (Math.min(pct, 100) / 100) * circ;
    const color = pct >= 100 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444';
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
                strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                transform={`rotate(-90 ${size/2} ${size/2})`} />
            <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="13" fontWeight="bold">
                {Math.round(pct)}%
            </text>
        </svg>
    );
};
