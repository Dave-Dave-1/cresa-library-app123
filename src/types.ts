export type Page =
  | 'Overview'
  | 'My Library'
  | 'Discover'
  | 'Saved for later'
  | 'Community'
  | 'Settings'
  | 'Lecturer dashboard'
  | 'User administration'
  | 'Resource administration'
  | 'Resource details'
  | 'Reader'
  | 'Meet the Team'
  | 'About'

export type IconName =
  | 'grid' | 'book' | 'compass' | 'bookmark' | 'users' | 'settings' | 'help'
  | 'search' | 'bell' | 'plus' | 'chevron' | 'arrow' | 'menu' | 'close'
  | 'more' | 'check' | 'clock' | 'trend' | 'sparkle' | 'play' | 'filter'
  | 'sliders' | 'heart' | 'share' | 'download' | 'file' | 'message'
  | 'send' | 'eye' | 'eyeOff' | 'calendar' | 'archive' | 'trash' | 'sun'

export type Resource = {
  id: number
  title: string
  author: string
  kind: string
  tone: string
  progress: number
  pages: number
  saved: boolean
  description: string
  year: string
  courseCode: string
  format: string
  fileSize: string
  downloadUrl: string
  language: string
  identifier: string
  keywords: string[]
  availability: 'Available' | 'Restricted' | 'Unavailable'
  addedAt: string
  edition?: string
}

