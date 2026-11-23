// Drive API calls, made as the script owner with the script's own OAuth token. The browser
// never sees a token: it only gets a session URL that accepts one specific file.

const UPLOAD_ENDPOINT =
  'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id'
const FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files'
const FILE_FIELDS = 'id,parents,size,mimeType,appProperties,imageMediaMetadata(width,height)'

function header(response, name) {
  const headers = response.getHeaders()
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase())
  return key ? headers[key] : null
}

export function createDrive(folderId) {
  if (!folderId) throw new Error('ORIGINALS_FOLDER_ID is not set. Run setup() once.')
  const auth = () => ({ Authorization: `Bearer ${ScriptApp.getOAuthToken()}` })

  return {
    folderId,

    /**
     * Opens a resumable upload session for one file in the originals folder. The Origin
     * header ties the session to the site, so the browser may upload to it (CORS).
     */
    createUploadSession({ name, mime, bytes, origin, properties }) {
      const response = UrlFetchApp.fetch(UPLOAD_ENDPOINT, {
        method: 'post',
        contentType: 'application/json; charset=UTF-8',
        headers: {
          ...auth(),
          Origin: origin,
          'X-Upload-Content-Type': mime,
          'X-Upload-Content-Length': String(bytes),
        },
        payload: JSON.stringify({ name, parents: [folderId], appProperties: properties }),
        muteHttpExceptions: true,
      })
      const location = header(response, 'Location')
      if (response.getResponseCode() !== 200 || !location) {
        throw new Error(
          `Drive session ${response.getResponseCode()}: ${response.getContentText().slice(0, 300)}`,
        )
      }
      return location
    },

    /** A small thumbnail as a data URL, or null (Drive makes them for photos it can read). */
    thumbnail(id) {
      try {
        const blob = DriveApp.getFileById(id).getThumbnail()
        if (!blob) return null
        return `data:${blob.getContentType()};base64,${Utilities.base64Encode(blob.getBytes())}`
      } catch {
        return null
      }
    },

    /**
     * Thumbnails for several files, asked from Drive in parallel, as data URLs (null where
     * Drive has none). A file Drive's API can't answer for falls back to thumbnail(id).
     */
    thumbnails(ids) {
      const metas = UrlFetchApp.fetchAll(
        ids.map((id) => ({
          url: `${FILES_ENDPOINT}/${encodeURIComponent(id)}?fields=thumbnailLink`,
          headers: auth(),
          muteHttpExceptions: true,
        })),
      )
      const links = metas.map((r) => {
        if (r.getResponseCode() !== 200) return null
        const link = JSON.parse(r.getContentText()).thumbnailLink
        return link ? link.replace(/=s\d+$/, '=s320') : null
      })
      const asked = links.map((link, i) => ({ link, i })).filter((x) => x.link)
      const images = UrlFetchApp.fetchAll(
        asked.map(({ link }) => ({ url: link, headers: auth(), muteHttpExceptions: true })),
      )
      const out = ids.map(() => undefined)
      asked.forEach(({ i }, k) => {
        const r = images[k]
        if (r.getResponseCode() !== 200) return
        const blob = r.getBlob()
        out[i] = `data:${blob.getContentType()};base64,${Utilities.base64Encode(blob.getBytes())}`
      })
      return out.map((url, i) => (url === undefined ? this.thumbnail(ids[i]) : url))
    },

    /** Every file in the originals folder (not in the trash): [{ id, created }]. */
    listFiles() {
      const out = []
      const it = DriveApp.getFolderById(folderId).searchFiles('trashed = false')
      while (it.hasNext()) {
        const f = it.next()
        out.push({ id: f.getId(), created: f.getDateCreated().toISOString() })
      }
      return out
    },

    /** Opens a photo to anyone with its link (for the reveal), or makes it private again. */
    setPublic(id, isPublic) {
      const file = DriveApp.getFileById(id)
      if (isPublic) file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)
      else file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE)
    },

    trash(id) {
      DriveApp.getFileById(id).setTrashed(true)
    },

    /** The file's metadata, or null if Drive doesn't have it. */
    getFile(id) {
      const response = UrlFetchApp.fetch(
        `${FILES_ENDPOINT}/${encodeURIComponent(id)}?fields=${encodeURIComponent(FILE_FIELDS)}`,
        { headers: auth(), muteHttpExceptions: true },
      )
      if (response.getResponseCode() === 404) return null
      if (response.getResponseCode() !== 200) {
        throw new Error(`Drive get ${response.getResponseCode()}`)
      }
      const file = JSON.parse(response.getContentText())
      return {
        id: file.id,
        parents: file.parents || [],
        size: Number(file.size || 0),
        mimeType: file.mimeType,
        appProperties: file.appProperties || {},
        width: file.imageMediaMetadata?.width ?? null,
        height: file.imageMediaMetadata?.height ?? null,
      }
    },
  }
}
