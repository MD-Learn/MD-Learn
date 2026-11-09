// Opened from the disk image (or from the hidden copy macOS runs a downloaded app from), MDlearn stops working once the
// image is ejected: it offers to move itself to Applications, then opens again from there.
import { app, dialog } from 'electron'
import { offersMove } from './rules'
import { strings } from './strings'

/** True when the app is moving (it quits and opens again from Applications). */
export async function offerMoveToApplications(): Promise<boolean> {
  if (!offersMove({ platform: process.platform, packaged: app.isPackaged, exe: process.execPath, inApplications: process.platform === 'darwin' && app.isInApplicationsFolder() })) return false
  const s = strings(app.getLocale())
  const { response } = await dialog.showMessageBox({ type: 'question', message: s('moveTitle'), detail: s('moveDetail'), buttons: [s('move'), s('notNow')], defaultId: 0, cancelId: 1 })
  if (response !== 0) return false
  try {
    // an older copy already in Applications is replaced (it is not running: this one would have given way to it)
    return app.moveToApplicationsFolder({ conflictHandler: (conflict) => conflict === 'exists' })
  } catch (e) {
    dialog.showErrorBox(s('moveFailed'), (e as Error).message)
    return false
  }
}
