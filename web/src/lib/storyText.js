import { translate } from '../i18n/i18n.js'

/** A story's display title: its own, or one made from the author's name. */
export const storyTitle = (story, lang = 'he') =>
  story.title ||
  translate(lang, story.kind === 'photos' ? 'story.titlePhotos' : 'story.titleText', {
    name: story.author_name,
  })
