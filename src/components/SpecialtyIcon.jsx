import { useId } from 'react'

function normalizeSpecialtyKey(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function resolveSpecialtyIconType(name) {
  const key = normalizeSpecialtyKey(name)
  if (key.includes('gia dinh')) return 'family'
  if (key.includes('tim mach') || key.includes('tim mạch') || key.includes('tim')) return 'heart'
  if (key.includes('than kinh')) return 'brain'
  if (key.includes('ho hap') || key.includes('phoi')) return 'lungs'
  if (key.includes('mat') || key.includes('nhan khoa')) return 'eye'
  if (key.includes('tai mui hong') || key.includes('tai mũi họng')) return 'ent'
  if (key.includes('da lieu') || key.includes('da liễu')) return 'skin'
  if (key.includes('tieu hoa') || key.includes('gan mat') || key.includes('dạ dày')) return 'stomach'
  if (key.includes('noi tiet') || key.includes('nội tiết')) return 'endocrine'
  if (key.includes('co xuong') || key.includes('chan thuong')) return 'bone'
  if (key.includes('nhi')) return 'child'
  if (key.includes('nam hoc')) return 'male'
  if (key.includes('lao khoa')) return 'elder'
  if (key.includes('dinh duong')) return 'nutrition'
  if (key.includes('truyen nhiem')) return 'infection'
  if (key.includes('tiet nieu') || key.includes('than')) return 'kidney'
  if (key.includes('noi tong quat')) return 'general'
  return 'clinic'
}

function IconSvg({ children }) {
  const gradId = useId()
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="12" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#67e8f9" />
          <stop offset="1" stopColor="#0284c7" />
        </linearGradient>
      </defs>
      <g fill="none" stroke={`url(#${gradId})`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </svg>
  )
}

const ICONS = {
  family: (
    <IconSvg>
      <path d="M20 24v-4a6 6 0 0 1 12 0v4" />
      <path d="M14 24h36v24H14z" />
      <path d="M26 34h12" />
      <path d="M32 34v10" />
    </IconSvg>
  ),
  heart: (
    <IconSvg>
      <path d="M32 48s-14-9.2-14-18.2c0-5.2 4.2-8.8 9.2-8.8 3.1 0 5.8 1.6 7.4 4 1.6-2.4 4.3-4 7.4-4 5 0 9.2 3.6 9.2 8.8C46 38.8 32 48 32 48z" />
    </IconSvg>
  ),
  brain: (
    <IconSvg>
      <path d="M24 20c-4.4 0-8 3.2-8 7.2 0 2.2 1 4.2 2.6 5.4-1.2 1.2-1.9 2.8-1.9 4.6 0 3.6 3.2 6.8 7.2 6.8h20.2c4 0 7.2-3.2 7.2-6.8 0-1.8-.7-3.4-1.9-4.6 1.6-1.2 2.6-3.2 2.6-5.4 0-4-3.6-7.2-8-7.2-1.8 0-3.4.6-4.8 1.6C27.4 20.6 25.8 20 24 20z" />
      <path d="M28 28v12M36 26v14M44 28v12" />
    </IconSvg>
  ),
  lungs: (
    <IconSvg>
      <path d="M32 16v32" />
      <path d="M32 24c-8 0-12 6-12 12s4 12 12 12" />
      <path d="M32 24c8 0 12 6 12 12s-4 12-12 12" />
    </IconSvg>
  ),
  eye: (
    <IconSvg>
      <path d="M10 32s10-14 22-14 22 14 22 14-10 14-22 14S10 32 10 32z" />
      <circle cx="32" cy="32" r="6" />
    </IconSvg>
  ),
  ent: (
    <IconSvg>
      <path d="M24 18c0 8-8 10-8 18" />
      <path d="M40 18c0 8 8 10 8 18" />
      <path d="M28 42h8" />
    </IconSvg>
  ),
  skin: (
    <IconSvg>
      <path d="M18 24c0-6 6-10 14-10s14 4 14 10v16c0 6-6 10-14 10s-14-4-14-10V24z" />
      <path d="M24 30h16M24 38h12" />
    </IconSvg>
  ),
  stomach: (
    <IconSvg>
      <path d="M22 18h20c4 0 8 4 8 10v8c0 8-6 14-14 14H24c-8 0-14-6-14-14v-8c0-6 4-10 8-10z" />
      <path d="M30 24h12" />
    </IconSvg>
  ),
  endocrine: (
    <IconSvg>
      <path d="M24 16h16l-4 32H28z" />
      <path d="M28 24h8" />
    </IconSvg>
  ),
  bone: (
    <IconSvg>
      <path d="M20 20l8 8-8 8M44 20l-8 8 8 8" />
      <path d="M28 28h8" />
    </IconSvg>
  ),
  child: (
    <IconSvg>
      <circle cx="32" cy="22" r="6" />
      <path d="M18 46c2-8 8-12 14-12s12 4 14 12" />
    </IconSvg>
  ),
  male: (
    <IconSvg>
      <circle cx="26" cy="38" r="10" />
      <path d="M34 30l12-12M40 18h6v6" />
    </IconSvg>
  ),
  elder: (
    <IconSvg>
      <path d="M20 42c2-10 8-14 12-14s10 4 12 14" />
      <path d="M24 24c2-4 6-6 8-6s6 2 8 6" />
    </IconSvg>
  ),
  nutrition: (
    <IconSvg>
      <path d="M34 18c0 8-10 8-10 16 0 4 4 8 8 8s8-4 8-8c0-8-10-8-10-16z" />
      <path d="M34 18v-4M30 14h8" />
    </IconSvg>
  ),
  infection: (
    <IconSvg>
      <circle cx="32" cy="32" r="8" />
      <path d="M32 12v8M32 44v8M12 32h8M44 32h8M18 18l6 6M40 40l6 6M46 18l-6 6M18 46l6-6" />
    </IconSvg>
  ),
  kidney: (
    <IconSvg>
      <path d="M32 16c-10 0-16 8-16 16s6 16 16 16 16-8 16-16-6-16-16-16z" />
      <path d="M32 16v32" />
    </IconSvg>
  ),
  general: (
    <IconSvg>
      <path d="M18 24h28v24H18z" />
      <path d="M26 18v6M38 18v6" />
      <path d="M28 34h8M32 30v8" />
    </IconSvg>
  ),
  clinic: (
    <IconSvg>
      <path d="M32 14v36" />
      <path d="M20 26h24" />
      <path d="M20 42h24" />
    </IconSvg>
  ),
}

export default function SpecialtyIcon({ name, className = '' }) {
  const type = resolveSpecialtyIconType(name)
  return <span className={className}>{ICONS[type] || ICONS.clinic}</span>
}
