// Tamar 70 – JSON API. Every call is a POST with Content-Type: text/plain (see spec).
function doPost(e) {
  const req = JSON.parse(e.postData.contents || '{}')
  return json({ ok: true, action: req.action || null })
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  )
}
