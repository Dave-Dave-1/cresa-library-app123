import type { Resource } from '../types'
import { Empty, Icon, PageIntro, ResourceCard } from '../components/ui'

export function SavedPage({ resources, showResource, toggleSaved }: { resources: Resource[]; showResource: (resource: Resource) => void; toggleSaved: (resource: Resource) => void }) {
  return <PageIntro eyebrow="YOUR READING QUEUE" title="Saved for later" copy="A small, intentional list of ideas you want to come back to."><div className="saved-summary"><span><Icon name="bookmark" /></span><div><strong>{resources.length} saved resources</strong><p>Choose one when you are ready for your next read.</p></div></div>{resources.length ? <div className="book-grid saved-grid">{resources.map(resource => <ResourceCard key={resource.id} resource={resource} onClick={() => showResource(resource)} saved onSave={() => toggleSaved(resource)} />)}</div> : <Empty icon="bookmark" title="Your saved list is empty" copy="Save something from Discover and it will be ready here." />}</PageIntro>
}
