# Cresa Library Feature Checklist

This file is the implementation checklist for the Cresa Library web app. Check an item only when it is built, tested, and connected to the correct backend or service.

## 1. Application foundation

- [x] Responsive desktop, tablet, and mobile layouts
- [x] Public welcome page
- [x] Authenticated application shell
- [x] Student/faculty navigation
- [x] Administrator navigation
- [x] Global search access
- [x] Breadcrumbs and page titles
- [x] Loading and skeleton states
- [x] Empty states
- [x] Error pages for missing, forbidden, and failed resources
- [x] Mobile navigation menu
- [x] Shared buttons, forms, cards, tables, badges, dialogs, and notifications

## 2. Authentication

- [ ] Student registration
- [ ] Faculty registration
- [ ] Administrator account provisioning
- [ ] Login with email and password
- [ ] Logout
- [ ] Persistent sessions
- [ ] Email verification
- [ ] Forgot password
- [ ] Password reset
- [ ] Password strength validation
- [ ] Duplicate email validation
- [ ] Login error handling
- [ ] Session expiration handling
- [ ] Protected routes
- [ ] Account deletion request

## 3. Users, profiles, and permissions

- [ ] User profile page
- [ ] Edit name, avatar, institution, and course
- [ ] Change password
- [ ] Change email with verification
- [ ] Display user role
- [ ] Standard user role
- [ ] Administrator role
- [ ] Active account status
- [ ] Pending account status
- [ ] Suspended account status
- [ ] Server-side role authorization
- [ ] Theme, language, notification, and AI preferences
- [ ] Privacy controls for activity and chat history

## 4. Catalog and discovery

- [ ] Catalog home page
- [ ] Featured resources
- [ ] Recently added resources
- [ ] Popular resources
- [ ] Recommended resources
- [ ] Browse by subject
- [ ] Browse by course
- [ ] Browse by genre/category
- [ ] Browse by author
- [ ] Browse by resource type
- [ ] Search by title
- [ ] Search by author
- [ ] Search by keyword
- [ ] Search by ISBN or identifier
- [ ] Search by course and subject
- [ ] Search result highlighting
- [ ] Filter by author, title, genre, course, and subject
- [ ] Filter by language, year, type, and availability
- [ ] Sort by relevance, title, author, date, and popularity
- [ ] Pagination or infinite scrolling
- [ ] Clear filters
- [ ] Recent searches
- [ ] Helpful no-results state

## 5. Resource details

- [ ] Resource detail page
- [ ] Title and subtitle
- [ ] Author and contributors
- [ ] Cover image
- [ ] Description and abstract
- [ ] Genre, subject, course, and keyword tags
- [ ] ISBN or external identifier
- [ ] Publication date and edition
- [ ] Language and file type
- [ ] File size and page count
- [ ] Availability status
- [ ] Read now action
- [ ] Save to library action
- [ ] Remove from library action
- [ ] Reading progress indicator
- [ ] Related resources
- [ ] Author links
- [ ] Report incorrect metadata
- [ ] Report broken file
- [ ] Shareable internal resource URL

## 6. Personal library and reading activity

- [ ] Saved resources list
- [ ] Currently reading list
- [ ] Completed resources list
- [ ] Reading history
- [ ] Continue reading action
- [ ] Reading progress percentage
- [ ] Last-read page and timestamp
- [ ] Mark resource as completed
- [ ] Remove resource from history
- [ ] Personal library search
- [ ] Personal library filters
- [ ] Reading activity summary
- [ ] Personal notes planning point

## 7. PDF reading

- [ ] In-browser PDF viewer
- [ ] Page navigation
- [ ] Page number input
- [ ] Previous/next page controls
- [ ] Zoom controls
- [ ] Fit-to-page mode
- [ ] Fit-to-width mode
- [ ] PDF text search
- [ ] Fullscreen mode
- [ ] Permission-controlled downloads
- [ ] Desktop reader with AI side panel
- [ ] Mobile reader with AI drawer
- [ ] Automatic progress updates
- [ ] Resume from last page
- [ ] Reader loading state
- [ ] Corrupt/unavailable file error state
- [ ] Unauthorized access response
- [ ] Keyboard controls

## 8. Gemini AI assistant

- [ ] AI access from catalog
- [ ] AI access from resource details
- [ ] AI access inside the PDF reader
- [ ] Persistent desktop chat panel
- [ ] Mobile chat drawer
- [ ] Start a conversation
- [ ] Continue a conversation
- [ ] Rename a conversation
- [ ] Delete a conversation
- [ ] Ask general academic questions
- [ ] Ask questions about the current resource
- [ ] Ask questions about a selected chapter or page
- [ ] Summarize a resource
- [ ] Summarize a chapter or section
- [ ] Explain complex topics simply
- [ ] Define terms
- [ ] Give examples and comparisons
- [ ] Generate study questions
- [ ] Generate flashcard prompts
- [ ] Recommend related resources
- [ ] Create a study path
- [ ] Display source/page context where possible
- [ ] Copy AI response
- [ ] Regenerate AI response
- [ ] Stop streaming response
- [ ] Typing and streaming states
- [ ] Rate or report AI response
- [ ] Missing-context handling
- [ ] API error and timeout handling
- [ ] Rate-limit handling
- [ ] Responsible-use notice
- [ ] Server-side Gemini API key
- [ ] Consistent system prompts
- [ ] AI usage logging without unnecessary private content

## 9. Administrator dashboard

- [ ] Administrator-only dashboard
- [ ] Total users metric
- [ ] Active users metric
- [ ] Published resources metric
- [ ] Draft resources count
- [ ] Archived resources count
- [ ] Recent uploads
- [ ] Recent registrations
- [ ] Reading activity summary
- [ ] AI usage summary
- [ ] Failed upload/processing list
- [ ] Date-range filters
- [ ] Charts or visual reports
- [ ] Quick action to add resources
- [ ] Quick action to manage users

## 10. Resource administration

- [ ] Admin resource table
- [ ] Search resources
- [ ] Filter by status, category, course, and date
- [ ] Add resource metadata
- [ ] Upload PDF
- [ ] Validate type and size
- [ ] Show upload progress
- [ ] Save as draft
- [ ] Publish resource
- [ ] Unpublish resource
- [ ] Archive resource
- [ ] Edit metadata
- [ ] Replace resource file
- [ ] Delete with confirmation
- [ ] Bulk status actions
- [ ] Manage categories, subjects, courses, and tags
- [ ] Upload processing status
- [ ] Validation and processing errors
- [ ] Resource audit history

## 11. User administration

- [ ] Admin user table
- [ ] Search users by name or email
- [ ] Filter by role and account status
- [ ] View user summary
- [ ] Change user role with confirmation
- [ ] Suspend account
- [ ] Reactivate account
- [ ] Resend verification email
- [ ] Force password reset
- [ ] View user activity summary
- [ ] Deactivate/delete account according to policy
- [ ] User audit history

## 12. File storage and processing

- [ ] Private PDF storage
- [ ] Temporary authorized file URLs
- [ ] File type validation
- [ ] Maximum file size validation
- [ ] Safe filename handling
- [ ] Duplicate file warning
- [ ] File integrity checks
- [ ] PDF metadata extraction
- [ ] Page count extraction
- [ ] Text extraction for AI context
- [ ] Upload retry handling
- [ ] Failed processing recovery
- [ ] File replacement without losing metadata
- [ ] Backup strategy
- [ ] Retention and deletion policy

## 13. Notifications and feedback

- [ ] In-app success notifications
- [ ] In-app error notifications
- [ ] Upload completion notification
- [ ] Account verification notification
- [ ] Password reset notification
- [ ] Optional email notifications
- [ ] Notification preferences
- [ ] Dismissible alerts
- [ ] Destructive-action confirmations
- [ ] Broken-resource feedback form
- [ ] AI response feedback/report action

## 14. Security and privacy

- [ ] HTTPS in production
- [ ] Secure password handling
- [ ] Server-side authorization
- [ ] Protected API endpoints
- [ ] Rate limiting for login, uploads, search, and AI
- [ ] Input validation and sanitization
- [ ] Malicious upload review strategy
- [ ] Private document access control
- [ ] Gemini key excluded from client code
- [ ] Minimum necessary personal-data collection
- [ ] Chat retention policy
- [ ] User data export/deletion process
- [ ] Copyright and acceptable-use policy
- [ ] Audit logs for sensitive actions
- [ ] Backup and disaster recovery plan
- [ ] Environment-specific secrets

## 15. Accessibility

- [ ] Full keyboard navigation
- [ ] Visible focus states
- [ ] Semantic HTML
- [ ] Form labels
- [ ] Screen-reader status messages
- [ ] Sufficient color contrast
- [ ] Resizable text
- [ ] Accessible dialogs and menus
- [ ] Accessible reader controls
- [ ] Reduced-motion support
- [ ] Clear validation messages

## 16. Performance and reliability

- [ ] Lazy-load large views
- [ ] Optimize cover images and static assets
- [ ] Paginate large lists
- [ ] Cache safe catalog requests
- [ ] Frontend error tracking
- [ ] Backend error tracking
- [ ] API latency monitoring
- [ ] Storage and processing monitoring
- [ ] Gemini usage and cost monitoring
- [ ] Health-check endpoint
- [ ] Structured logs
- [ ] Backup verification
- [ ] Graceful AI-service failure state
- [ ] Graceful storage-service failure state

## 17. Testing and release

- [ ] Unit tests for validation and utilities
- [ ] Component tests for forms, search, chat, and reader controls
- [ ] API integration tests
- [ ] Authentication tests
- [ ] Authorization tests
- [ ] File upload tests
- [ ] Mocked Gemini integration tests
- [ ] End-to-end registration/login test
- [ ] End-to-end catalog/search test
- [ ] End-to-end reading test
- [ ] End-to-end save/resume test
- [ ] End-to-end AI question test
- [ ] End-to-end admin upload test
- [ ] Responsive browser testing
- [ ] Accessibility testing
- [ ] Security review
- [ ] Production build check
- [ ] Deployment check

## First-release acceptance checklist

- [ ] A verified user can sign in securely.
- [ ] Users can search and filter published resources.
- [ ] Users can open and read an authorized PDF in the browser.
- [ ] Reading progress persists between sessions.
- [ ] Users can save and resume resources.
- [ ] Users can ask Gemini about an authorized resource.
- [ ] Gemini credentials are never exposed in the React client.
- [ ] An administrator can upload, edit, publish, archive, and delete resources.
- [ ] An administrator can manage user roles and account status.
- [ ] Critical workflows have automated tests.
- [ ] The application works on current desktop and mobile browsers.
- [ ] Deployment, backups, environment variables, and recovery steps are documented.
