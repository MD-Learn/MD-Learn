// The few words the desktop app says itself (its update dialogs and menu items), in the languages Studio speaks.
type Key = 'help' | 'check' | 'auto' | 'readyTitle' | 'readyDetail' | 'restart' | 'later' | 'availableTitle' | 'availableDetail' | 'download' | 'downloading' | 'latestTitle' | 'latestDetail' | 'failedTitle' | 'off'
const EN: Record<Key, string> = {
  help: 'Help',
  check: 'Check for updates…',
  auto: 'Check for updates automatically',
  readyTitle: 'MDlearn {v} is ready',
  readyDetail: 'Restart MDlearn to use it. Your notes and progress stay as they are.',
  restart: 'Restart now',
  later: 'Later',
  availableTitle: 'MDlearn {v} is available',
  availableDetail: 'Download it from the release page and install it over this one. Your notes and progress stay as they are.',
  download: 'Download',
  downloading: 'MDlearn {v} is downloading. MDlearn will ask you to restart when it is ready.',
  latestTitle: 'You have the latest version',
  latestDetail: 'MDlearn {v}',
  failedTitle: 'Could not check for updates',
  off: 'Updates are turned off on this computer.',
}
const IT: Record<Key, string> = {
  help: 'Aiuto',
  check: 'Cerca aggiornamenti…', auto: 'Cerca aggiornamenti automaticamente', readyTitle: 'MDlearn {v} è pronto',
  readyDetail: 'Riavvia MDlearn per usarlo. I tuoi appunti e i tuoi progressi restano come sono.', restart: 'Riavvia ora', later: 'Più tardi',
  availableTitle: 'È disponibile MDlearn {v}', availableDetail: 'Scaricalo dalla pagina della versione e installalo sopra questo. I tuoi appunti e i tuoi progressi restano come sono.',
  download: 'Scarica', downloading: 'MDlearn {v} si sta scaricando. MDlearn ti chiederà di riavviare quando sarà pronto.', latestTitle: 'Hai l’ultima versione',
  latestDetail: 'MDlearn {v}', failedTitle: 'Impossibile cercare aggiornamenti', off: 'Gli aggiornamenti sono disattivati su questo computer.',
}
const ES: Record<Key, string> = {
  help: 'Ayuda',
  check: 'Buscar actualizaciones…', auto: 'Buscar actualizaciones automáticamente', readyTitle: 'MDlearn {v} está listo',
  readyDetail: 'Reinicia MDlearn para usarlo. Tus apuntes y tu progreso se quedan como están.', restart: 'Reiniciar ahora', later: 'Más tarde',
  availableTitle: 'Está disponible MDlearn {v}', availableDetail: 'Descárgalo de la página de la versión e instálalo encima de este. Tus apuntes y tu progreso se quedan como están.',
  download: 'Descargar', downloading: 'MDlearn {v} se está descargando. MDlearn te pedirá reiniciar cuando esté listo.', latestTitle: 'Tienes la última versión',
  latestDetail: 'MDlearn {v}', failedTitle: 'No se pudieron buscar actualizaciones', off: 'Las actualizaciones están desactivadas en este ordenador.',
}
const FR: Record<Key, string> = {
  help: 'Aide',
  check: 'Rechercher des mises à jour…', auto: 'Rechercher les mises à jour automatiquement', readyTitle: 'MDlearn {v} est prêt',
  readyDetail: 'Redémarrez MDlearn pour l’utiliser. Vos notes et vos progrès restent tels quels.', restart: 'Redémarrer maintenant', later: 'Plus tard',
  availableTitle: 'MDlearn {v} est disponible', availableDetail: 'Téléchargez-le depuis la page de la version et installez-le par-dessus celui-ci. Vos notes et vos progrès restent tels quels.',
  download: 'Télécharger', downloading: 'MDlearn {v} se télécharge. MDlearn vous proposera de redémarrer quand il sera prêt.', latestTitle: 'Vous avez la dernière version',
  latestDetail: 'MDlearn {v}', failedTitle: 'Impossible de rechercher des mises à jour', off: 'Les mises à jour sont désactivées sur cet ordinateur.',
}
const CA: Record<Key, string> = {
  help: 'Ajuda',
  check: 'Cerca actualitzacions…', auto: 'Cerca actualitzacions automàticament', readyTitle: 'MDlearn {v} està a punt',
  readyDetail: 'Reinicia MDlearn per fer-lo servir. Els teus apunts i el teu progrés es queden com estan.', restart: 'Reinicia ara', later: 'Més tard',
  availableTitle: 'Hi ha disponible MDlearn {v}', availableDetail: 'Descarrega’l de la pàgina de la versió i instal·la’l a sobre d’aquest. Els teus apunts i el teu progrés es queden com estan.',
  download: 'Descarrega', downloading: 'MDlearn {v} s’està descarregant. MDlearn et demanarà que el reiniciïs quan estigui a punt.', latestTitle: 'Tens l’última versió',
  latestDetail: 'MDlearn {v}', failedTitle: 'No s’han pogut cercar actualitzacions', off: 'Les actualitzacions estan desactivades en aquest ordinador.',
}
const BY_LANG: Record<string, Record<Key, string>> = { en: EN, it: IT, es: ES, fr: FR, ca: CA }

/** The words for a system language such as `it-IT` (English when it is not one of Studio's). */
export function strings(locale: string): (key: Key, v?: string) => string {
  const table = BY_LANG[locale.toLowerCase().split(/[-_]/)[0]] ?? EN
  return (key, v) => table[key].replace('{v}', v ?? '')
}
