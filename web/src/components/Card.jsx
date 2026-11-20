import styles from './Card.module.css'

/** A paper card. Give it a `tone` (a category's tone name) to get the colored top stripe. */
export function Card({ as: Component = 'article', tone, className = '', ...props }) {
  const classes = [styles.card, tone ? styles.toned : '', className].filter(Boolean).join(' ')
  return <Component className={classes} data-tone={tone} {...props} />
}
