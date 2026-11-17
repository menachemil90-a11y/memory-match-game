/**
 * English UI strings. Every user-facing string lives here so other
 * languages (Hebrew/RTL next) can be added without touching components.
 */
const en = {
  common: {
    appName: 'Memory Match',
    back: 'Back',
    close: 'Close',
    comingSoon: 'Coming soon',
    comingInPhase: 'This screen arrives in phase {{phase}}.',
  },
  home: {
    tagline: 'Find the pairs!',
    solo: 'Solo',
    twoPlayers: '2 Players',
    online: 'Play Online',
    myBoards: 'My Boards',
    settings: 'Settings',
  },
  boards: {
    title: 'Pick a board',
    create: 'Create board',
  },
  levels: {
    title: 'Pick a level',
  },
  setup: {
    title: 'Who is playing?',
  },
  game: {
    title: 'Game',
  },
  results: {
    title: 'Results',
  },
  myBoards: {
    title: 'My Boards',
    editorTitle: 'Edit board',
    cropTitle: 'Crop photos',
  },
  online: {
    title: 'Play Online',
    room: 'Room {{code}}',
  },
  settings: {
    title: 'Settings',
    credits: 'Credits & licenses',
  },
  notFound: {
    title: 'Oops!',
    message: 'This page went missing.',
    goHome: 'Go home',
  },
} as const;

export default en;
