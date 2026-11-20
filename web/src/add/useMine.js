import { SITE_STATUS } from '@tamar70/shared'
import { loadMine } from './deviceStore.js'

/**
 * Which stories this device may edit: the ones it sent (it holds their edit tokens), and
 * only while the site is collecting.
 */
export function useCanEdit(site) {
  const mine = loadMine()
  const open = site?.site_status === SITE_STATUS.COLLECTING
  return (storyId) => open && Boolean(mine[storyId])
}
