const DiffMatchPatch = require('diff-match-patch')
const dmp = new DiffMatchPatch()

function computeDiff(oldText, newText) {
  try {
    const diffs = dmp.diff_main(oldText || '', newText || '')
    dmp.diff_cleanupSemantic(diffs)
    return dmp.diff_toDelta(diffs)
  } catch (e) {
    return null
  }
}

function applyDiff(oldText, delta) {
  try {
    const diffs = dmp.diff_fromDelta(oldText, delta)
    const patches = dmp.patch_make(oldText, diffs)
    const [newText] = dmp.patch_apply(patches, oldText)
    return newText
  } catch {
    return oldText
  }
}

function getDiffHTML(oldText, newText) {
  try {
    const diffs = dmp.diff_main(oldText || '', newText || '')
    dmp.diff_cleanupSemantic(diffs)
    return dmp.diff_prettyHtml(diffs)
  } catch (e) {
    return ''
  }
}

module.exports = { computeDiff, applyDiff, getDiffHTML }
