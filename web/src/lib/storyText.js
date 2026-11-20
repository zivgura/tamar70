/** A memory's display title: its own, or one made from the author's name. */
export const storyTitle = (story) =>
  story.title ||
  (story.kind === 'photos' ? `תמונות מ${story.author_name}` : `סיפור מ${story.author_name}`)
