import React from 'react';

const Icon = ({ d, size = 20, className = '', strokeWidth = 2 }: { d: string | string[]; size?: number; className?: string; strokeWidth?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
        {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
);

export const QrCode         = (p: any) => <Icon {...p} d={['M3 3h6v6H3z','M15 3h6v6h-6z','M3 15h6v6H3z','M15 15h2v2h-2z','M19 15v2','M17 19h4','M19 19v2']} />;
export const Printer        = (p: any) => <Icon {...p} d={['M6 9V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v5','M6 18H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2','M6 14h12v7H6z']} />;
export const ChevronUp      = (p: any) => <Icon {...p} d={['M18 15l-6-6-6 6']} />;
export const ChevronRight   = (p: any) => <Icon {...p} d={['M9 6l6 6-6 6']} />;
export const ChevronDown    = (p: any) => <Icon {...p} d="M6 9l6 6 6-6" />;
export const FileText       = (p: any) => <Icon {...p} d={['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z','M14 2v6h6','M16 13H8','M16 17H8','M10 9H8']} />;
export const BarChart3      = (p: any) => <Icon {...p} d="M3 3v18h18M18 9l-5 5-4-4-3 3" />;
export const LogOut         = (p: any) => <Icon {...p} d={['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4','M16 17l5-5-5-5','M21 12H9']} />;
export const Search         = (p: any) => <Icon {...p} d={['M21 21l-4.35-4.35','M11 19A8 8 0 1 0 11 3a8 8 0 0 0 0 16z']} />;
export const History        = (p: any) => <Icon {...p} d={['M3 3v5h5','M3.05 13A9 9 0 1 0 6 5.3L3 8']} />;
export const Database       = (p: any) => <Icon {...p} d={['M12 2C6.48 2 2 3.79 2 6v12c0 2.21 4.48 4 10 4s10-1.79 10-4V6c0-2.21-4.48-4-10-4z','M2 6c0 2.21 4.48 4 10 4s10-1.79 10-4','M2 12c0 2.21 4.48 4 10 4s10-1.79 10-4']} />;
export const Palette        = (p: any) => <Icon {...p} d="M12 2a10 10 0 1 0 0 20c1.7 0 3-.4 4-1a2 2 0 0 0 0-3.5C15.5 17 15 16.3 15 15.5a2.5 2.5 0 0 1 2.5-2.5H20a2 2 0 0 0 2-2 10 10 0 0 0-10-9z" />;
export const Boxes          = (p: any) => <Icon {...p} d={['M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42z','M7 16.5l-4.74-2.85','M7 16.5l5-3','M7 16.5V21','M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3z','M17 16.5l-5-3','M17 16.5l4.74-2.85','M17 16.5V21','M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8z','M12 8l-4.74 2.85','M12 8l4.74 2.85','M12 13.5V8']} />;
export const Plus           = (p: any) => <Icon {...p} d="M12 5v14M5 12h14" />;
export const Trash2         = (p: any) => <Icon {...p} d={['M3 6h18','M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6','M10 11v6','M14 11v6','M9 6V4h6v2']} />;
export const Download       = (p: any) => <Icon {...p} d={['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4','M7 10l5 5 5-5','M12 15V3']} />;
export const Upload         = (p: any) => <Icon {...p} d={['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4','M17 8l-5-5-5 5','M12 3v12']} />;
export const Edit2          = (p: any) => <Icon {...p} d={['M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z']} />;
export const Check          = (p: any) => <Icon {...p} d="M20 6L9 17l-5-5" />;
export const Camera         = (p: any) => <Icon {...p} d={['M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z','M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z']} />;
export const CameraOff      = (p: any) => <Icon {...p} d={['M1 1l22 22','M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34','M8 8a4 4 0 0 0 5.66 5.66']} />;
export const Undo2          = (p: any) => <Icon {...p} d={['M9 14 4 9l5-5','M4 9h10.5a5.5 5.5 0 0 1 0 11H11']} />;
export const X              = (p: any) => <Icon {...p} d="M18 6L6 18M6 6l12 12" />;
export const MapPin         = (p: any) => <Icon {...p} d={['M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z','M12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z']} />;
export const Package        = (p: any) => <Icon {...p} d={['M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z','M3.27 6.96L12 12.01l8.73-5.05','M12 22.08V12']} />;
export const BookOpen       = (p: any) => <Icon {...p} d={['M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z','M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z']} />;
export const Zap            = (p: any) => <Icon {...p} d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />;
export const Timer          = (p: any) => <Icon {...p} d={['M12 22a9 9 0 1 0 0-18 9 9 0 0 0 0 18z','M12 6v6l4 2','M9.5 2h5','M12 2v3']} />;
export const Eye            = (p: any) => <Icon {...p} d={['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z','M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z']} />;
export const MessageSquare  = (p: any) => <Icon {...p} d={['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z']} />;
export const Volume2        = (p: any) => <Icon {...p} d={['M11 5L6 9H2v6h4l5 4V5z','M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07']} />;
export const VolumeX        = (p: any) => <Icon {...p} d={['M11 5L6 9H2v6h4l5 4V5z','M23 9l-6 6','M17 9l6 6']} />;
export const AlertTriangle  = (p: any) => <Icon {...p} d={['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z','M12 9v4','M12 17h.01']} />;
export const ShieldCheck    = (p: any) => <Icon {...p} d={['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z','M9 12l2 2 4-4']} />;
export const ClipboardList  = (p: any) => <Icon {...p} d={['M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2','M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2','M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2','M9 12h6','M9 16h4']} />;
export const Lock           = (p: any) => <Icon {...p} d={['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z','M17 11V7a5 5 0 0 0-10 0v4']} />;
export const Unlock         = (p: any) => <Icon {...p} d={['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z','M17 11V7a5 5 0 0 0-9.9-1']} />;
export const Warehouse      = (p: any) => <Icon {...p} d={['M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.21a2 2 0 0 1 1.48 0l8 3.21A2 2 0 0 1 22 8.35z','M6 18h12','M6 14h12','M15 22v-4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v4']} />;
export const Sparkles       = (p: any) => <Icon {...p} d={['M12 3l1.88 5.76 5.62.82-4.08 3.95.97 5.6L12 16.5l-5.39 2.63.97-5.6L3.5 9.58l5.62-.82z']} />;
export const MoreHorizontal = (p: any) => <Icon {...p} d={['M8 12h.01','M12 12h.01','M16 12h.01']} strokeWidth={3} />;
export const Users          = (p: any) => <Icon {...p} d={['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2','M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z','M23 21v-2a4 4 0 0 0-3-3.87','M16 3.13a4 4 0 0 1 0 7.75']} />;
export const PlayCircle     = (p: any) => <Icon {...p} d={['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z','M10 8l6 4-6 4V8z']} />;
export const RefreshCw      = (p: any) => <Icon {...p} d={['M23 4v6h-6','M1 20v-6h6','M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15']} />;
export const Wifi           = (p: any) => <Icon {...p} d={['M5 12.55a11 11 0 0 1 14.08 0','M1.42 9a16 16 0 0 1 21.16 0','M8.53 16.11a6 6 0 0 1 6.95 0','M12 20h.01']} />;
export const ArrowRight     = (p: any) => <Icon {...p} d={['M5 12h14','M12 5l7 7-7 7']} />;
export const Moon           = (p: any) => <Icon {...p} d={['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z']} />;
export const Sun            = (p: any) => <Icon {...p} d={['M12 1v2','M12 21v2','M4.22 4.22l1.42 1.42','M18.36 18.36l1.42 1.42','M1 12h2','M21 12h2','M4.22 19.78l1.42-1.42','M18.36 5.64l1.42-1.42','M12 5a7 7 0 1 0 0 14A7 7 0 0 0 12 5z']} />;
