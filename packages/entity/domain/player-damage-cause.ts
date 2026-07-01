export type PlayerDamageCause =
  | { readonly kind: 'generic' }
  | { readonly kind: 'fall' }
  | { readonly kind: 'mob' }
  | { readonly kind: 'projectile' }
  | { readonly kind: 'explosion' }
  | { readonly kind: 'lava' }
  | { readonly kind: 'fire' }
  | { readonly kind: 'cactus' }
  | { readonly kind: 'lightning' }
  | { readonly kind: 'suffocation' }
  | { readonly kind: 'void' }
  | { readonly kind: 'drowning' }
  | { readonly kind: 'starvation' }
  | { readonly kind: 'ender_pearl' }

const DEATH_MESSAGES: Record<PlayerDamageCause['kind'], string> = {
  fall:        'You hit the ground too hard.',
  mob:         'You were slain by a hostile mob.',
  projectile:  'You were shot.',
  explosion:   'You blew up.',
  lava:        'You tried to swim in lava.',
  fire:        'You went up in flames.',
  cactus:      'You were pricked to death.',
  lightning:   'You were struck by lightning.',
  suffocation: 'You suffocated in a wall.',
  void:        'You fell out of the world.',
  drowning:    'You drowned.',
  starvation:  'You starved to death.',
  ender_pearl: 'You teleported too hard.',
  generic:     'You died.',
}

export const describePlayerDeath = (cause: PlayerDamageCause | null | undefined): string =>
  cause !== null && cause !== undefined ? DEATH_MESSAGES[cause.kind] : DEATH_MESSAGES.generic
