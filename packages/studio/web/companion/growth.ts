// What the companion says when it grows, and the accent colour it wears (the orb needs a plain colour, not a CSS variable).
import { useEffect, useState } from 'react'
import { prettyTitle } from '../lib/title'
import type { Grew } from '../../shared/types'
import { t } from '../i18n'

export function growthLabel(g: Grew): string {
  switch (g.kind) {
    case 'read': return t('Well done, you read “{title}” · +{n}', { title: prettyTitle(g.title), n: g.gained })
    case 'exercise': return t('A question tried · +{n}', { n: g.gained })
    case 'explain': return t('Explained in your own words · +{n}', { n: g.gained })
    case 'session': return t('Review done · +{n}', { n: g.gained })
  }
}
export const levelNotice = (level: number, name?: string) => (name ? t('{name} reached level {n}!', { name, n: level }) : t('Your companion reached level {n}!', { n: level }))

const accentNow = () => (typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())
/** The accent colour of the current theme, kept up to date when the theme or the accent changes. */
export function useAccentColor(): string {
  const [color, setColor] = useState(accentNow)
  useEffect(() => {
    const update = () => setColor(accentNow())
    const watch = new MutationObserver(update)
    watch.observe(document.documentElement, { attributes: true })
    const dark = window.matchMedia('(prefers-color-scheme: dark)')
    dark.addEventListener('change', update)
    return () => { watch.disconnect(); dark.removeEventListener('change', update) }
  }, [])
  return color
}
