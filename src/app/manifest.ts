import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'iHNS — Chấm công',
    short_name: 'iHNS',
    description: 'Chấm công theo vị trí GPS cho nhân viên Hanoi Sun Travel',
    start_url: '/',
    display: 'standalone',
    background_color: '#031c29',
    theme_color: '#031c29',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
