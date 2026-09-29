# Cresa Library

Cresa Library is a web-based digital library for students and educators. It centralizes academic books, PDFs, and journals in one secure platform and adds an intelligent Gemini-powered reading assistant for research, explanations, summaries, and study recommendations.

This document is the product and implementation guide for the project. It should be updated whenever a feature, technical decision, or scope boundary changes.

For the trackable feature-by-feature implementation checklist, see [FEATURES.md](FEATURES.md).

## Vision

Build a reliable academic resource hub where a user can:

1. Discover the right book or journal quickly.
2. Read the material inside the browser.
3. Ask questions about what they are reading.
4. Receive useful summaries, definitions, and study guidance.
5. Return to their library and continue learning from any device.

Administrators should be able to maintain the catalog, manage access, and understand how the platform is being used without needing technical knowledge.

## Objectives

- **Centralize resources:** Store educational PDFs and documents in a secure, searchable repository.
- **Enhance learning with AI:** Use the Gemini API for contextual questions, chapter summaries, term definitions, and recommendations.
- **Streamline administration:** Provide an intuitive dashboard for managing books, users, permissions, and system metrics.
- **Protect academic content:** Enforce authentication, authorization, secure file access, and responsible AI handling.

## Scope

### In scope for the core product

- Student and faculty registration and login.
- Role-based access control for administrators and standard users.
- Search and filtering by title, author, genre, course, subject, and publication details.
- Book detail pages with metadata, availability, and reading actions.
- Browser-based PDF reading.
- Personal library features such as saved books, reading progress, and history.
- Persistent Gemini chat available from the catalog and reading experience.
- AI actions for summaries, definitions, contextual questions, and study recommendations.
- Admin tools for uploading, editing, publishing, archiving, and deleting resources.
- User management and basic system metrics for administrators.
- Database storage for users, resource metadata, reading activity, and chat history.
- Secure cloud or local storage for PDF assets.

### Out of scope for the first release

- Native iOS or Android applications.
- Public document sharing outside authenticated users.
- Full institutional library circulation, lending, or payment workflows.
- AI-generated academic work submitted on behalf of students.
- Training a custom language model.
- Real-time collaboration or annotations between users.
- Automated copyright acquisition or rights management.

These items can be reconsidered after the core product is stable and user feedback has been collected.

## Complete feature inventory

This is the full planned feature set for the Cresa Library web application. Each feature can be tracked as a separate implementation task.

### 1. Platform and navigation

- [ ] Responsive web application for desktop, tablet, and mobile.
- [ ] Public welcome page explaining the library and its purpose.
- [ ] Authenticated application shell with sidebar or mobile navigation.
- [ ] Separate user and administrator navigation areas.
- [ ] Global search access from the main application header.
- [ ] Breadcrumbs and clear page titles.
- [ ] Direct links to books, categories, search results, and user pages.
- [ ] Back, forward, and refresh-safe navigation.
- [ ] Loading screens and skeleton states.
- [ ] Empty states with useful next actions.
- [ ] Friendly error pages for missing, forbidden, and failed resources.
- [ ] Responsive mobile menu and touch-friendly controls.
- [ ] Consistent buttons, forms, dialogs, tables, cards, badges, and notifications.

### 2. Account registration and authentication

- [ ] Student registration.
- [ ] Faculty registration.
- [ ] Administrator account provisioning.
- [ ] Email and password login.
- [ ] Logout from the current device.
- [ ] Session persistence between visits.
- [ ] Email verification.
- [ ] Forgot-password request.
- [ ] Password reset.
- [ ] Password strength validation.
- [ ] Duplicate email validation.
- [ ] Login failure and account lockout messaging.
- [ ] Optional social or institutional single sign-on integration point.
- [ ] Protected routes for authenticated users.
- [ ] Session expiration and re-authentication handling.
- [ ] Account deletion request.

### 3. User profiles and permissions

- [ ] User profile page.
- [ ] Edit name, avatar, institution, course, and other profile details.
- [ ] Change password.
- [ ] Change email with verification.
- [ ] User role display.
- [ ] Role-based access control for standard users and administrators.
- [ ] Active, pending, suspended, and deactivated account states.
- [ ] Server-side authorization for every protected action.
- [ ] User preferences for theme, language, notifications, and AI behavior.
- [ ] Privacy controls for reading activity and chat history.

### 4. Catalog browsing and discovery

- [ ] Catalog home page.
- [ ] Featured resources section.
- [ ] Recently added resources section.
- [ ] Popular or most-read resources section.
- [ ] Recommended resources section.
- [ ] Browse by subject.
- [ ] Browse by course.
- [ ] Browse by genre or category.
- [ ] Browse by author.
- [ ] Browse by resource type.
- [ ] Search by title.
- [ ] Search by author.
- [ ] Search by keyword.
- [ ] Search by ISBN or identifier.
- [ ] Search by course or subject.
- [ ] Search result highlighting.
- [ ] Filters for author, title, genre, course, subject, language, year, and type.
- [ ] Filter by availability and publication status.
- [ ] Sort by relevance, title, author, date added, and popularity.
- [ ] Pagination or infinite scrolling.
- [ ] Clear all filters.
- [ ] Search history or recent searches.
- [ ] No-results recommendations.

### 5. Resource and book details

- [ ] Resource detail page.
- [ ] Title, subtitle, author, contributors, and publisher information.
- [ ] Cover image.
- [ ] Description and abstract.
- [ ] Genre, subject, course, and keyword tags.
- [ ] ISBN or external identifier.
- [ ] Publication date and edition.
- [ ] Language and file type.
- [ ] File size and page count.
- [ ] Resource status and availability.
- [ ] Read now action.
- [ ] Save to personal library action.
- [ ] Remove from personal library action.
- [ ] Reading progress indicator.
- [ ] Related and recommended resources.
- [ ] Author links.
- [ ] Report incorrect metadata or a broken file.
- [ ] Shareable internal resource URL.

### 6. Personal library and reading activity

- [ ] Saved resources list.
- [ ] Currently reading list.
- [ ] Completed resources list.
- [ ] Reading history.
- [ ] Continue reading action.
- [ ] Reading progress percentage.
- [ ] Last-read page and timestamp.
- [ ] Mark resource as completed.
- [ ] Remove resource from history.
- [ ] Personal notes placeholder for future expansion.
- [ ] Personal library search and filters.
- [ ] Reading activity summary.

### 7. PDF reading experience

- [ ] In-browser PDF viewer.
- [ ] Page navigation.
- [ ] Page number input.
- [ ] Next and previous page controls.
- [ ] Zoom in and zoom out.
- [ ] Fit-to-page and fit-to-width modes.
- [ ] Text search within the PDF.
- [ ] Fullscreen mode.
- [ ] Download behavior controlled by permissions.
- [ ] Reader layout that works beside the AI assistant.
- [ ] Mobile reader drawer layout.
- [ ] Automatic reading-progress updates.
- [ ] Resume from the last page.
- [ ] Reader loading indicator.
- [ ] Corrupt or unavailable file error state.
- [ ] Unauthorized access response.
- [ ] Keyboard shortcuts where supported by the viewer.

### 8. Gemini AI reading assistant

- [ ] AI assistant available from the catalog.
- [ ] AI assistant available from a resource detail page.
- [ ] AI assistant available inside the PDF reader.
- [ ] Persistent chat panel on desktop.
- [ ] Expandable chat drawer on mobile.
- [ ] Start a new conversation.
- [ ] Continue a previous conversation.
- [ ] Rename or delete a conversation.
- [ ] Ask general academic questions.
- [ ] Ask questions about the current resource.
- [ ] Ask questions about a selected chapter or page when context is available.
- [ ] Summarize a full resource when supported.
- [ ] Summarize a chapter or section.
- [ ] Explain complex topics in simpler language.
- [ ] Define terms.
- [ ] Provide examples and comparisons.
- [ ] Generate study questions.
- [ ] Generate flashcard prompts.
- [ ] Recommend related resources.
- [ ] Recommend a study path based on the user’s interests.
- [ ] Show the resource or page context used for an answer when possible.
- [ ] Copy an AI response.
- [ ] Regenerate a response.
- [ ] Stop a response while it is streaming.
- [ ] Show typing and streaming states.
- [ ] Rate or report an AI response.
- [ ] Handle missing document context.
- [ ] Handle API errors and timeouts.
- [ ] Handle rate limits and usage limits.
- [ ] Show a responsible-use notice for generated answers.
- [ ] Keep Gemini credentials server-side.
- [ ] Apply user and system prompts consistently.
- [ ] Log AI usage without exposing unnecessary private content.

### 9. Administrator dashboard

- [ ] Administrator-only dashboard.
- [ ] Total users metric.
- [ ] Active users metric.
- [ ] Total published resources metric.
- [ ] Draft and archived resource counts.
- [ ] Recent uploads list.
- [ ] Recent user registrations.
- [ ] Reading activity summary.
- [ ] AI usage summary.
- [ ] Failed uploads and processing errors.
- [ ] Date-range filtering for metrics.
- [ ] Basic charts or visual reports.
- [ ] Quick actions for adding resources and managing users.

### 10. Resource administration

- [ ] Admin resource list.
- [ ] Search resources in the admin area.
- [ ] Filter resources by status, category, course, and date.
- [ ] Add resource metadata.
- [ ] Upload a PDF.
- [ ] Validate file type and size.
- [ ] Show upload progress.
- [ ] Save as draft.
- [ ] Publish a resource.
- [ ] Unpublish or archive a resource.
- [ ] Edit resource metadata.
- [ ] Replace a resource file.
- [ ] Delete a resource with confirmation.
- [ ] Bulk status actions where appropriate.
- [ ] Configure categories, subjects, courses, and tags.
- [ ] Track upload and processing status.
- [ ] Show validation and processing errors.
- [ ] Record audit history for resource changes.

### 11. User administration

- [ ] Admin user list.
- [ ] Search users by name or email.
- [ ] Filter users by role and account status.
- [ ] View user profile summary.
- [ ] Change user role with confirmation.
- [ ] Suspend and reactivate accounts.
- [ ] Resend verification email.
- [ ] Force password reset where supported.
- [ ] View user activity summary.
- [ ] Deactivate or delete accounts according to policy.
- [ ] Record audit history for account changes.

### 12. File storage and document processing

- [ ] Private storage for PDF assets.
- [ ] Temporary authorized file access.
- [ ] File type validation.
- [ ] Maximum file size validation.
- [ ] Secure filename handling.
- [ ] Duplicate file detection or warning.
- [ ] File integrity checks.
- [ ] PDF metadata extraction where possible.
- [ ] Page count extraction where possible.
- [ ] Optional text extraction for AI context.
- [ ] Upload retry handling.
- [ ] Failed processing recovery.
- [ ] File replacement without losing resource metadata.
- [ ] Backup and restore strategy.
- [ ] Controlled deletion and retention policy.

### 13. Notifications and feedback

- [ ] In-app success notifications.
- [ ] In-app error notifications.
- [ ] Upload completion notification.
- [ ] Account verification notification.
- [ ] Password reset notification.
- [ ] Optional email notifications.
- [ ] Notification preferences.
- [ ] Dismissible alerts.
- [ ] Confirmation dialogs for destructive actions.
- [ ] Feedback form for broken resources.
- [ ] Feedback or report action for AI responses.

### 14. Security, privacy, and governance

- [ ] HTTPS in deployed environments.
- [ ] Secure password handling.
- [ ] Server-side authorization checks.
- [ ] Protected API endpoints.
- [ ] Rate limiting for login, uploads, search, and AI chat.
- [ ] Input validation and sanitization.
- [ ] Upload malware and abuse review strategy.
- [ ] Private document access control.
- [ ] No Gemini API key in client-side code.
- [ ] Minimal collection of personal data.
- [ ] Chat history retention policy.
- [ ] User data export or deletion process.
- [ ] Copyright and acceptable-use policy.
- [ ] Audit logs for sensitive actions.
- [ ] Backup and disaster recovery plan.
- [ ] Environment-specific secrets and configuration.

### 15. Accessibility and usability

- [ ] Keyboard navigation for all primary workflows.
- [ ] Visible focus states.
- [ ] Semantic HTML.
- [ ] Labels for all form controls.
- [ ] Screen-reader-friendly status messages.
- [ ] Sufficient color contrast.
- [ ] Resizable text and responsive layout.
- [ ] Accessible dialogs and menus.
- [ ] Accessible PDF reader controls where supported.
- [ ] Reduced-motion support.
- [ ] Clear validation messages.
- [ ] Consistent interaction patterns.

### 16. Performance, monitoring, and reliability

- [ ] Lazy-load large views and resource data.
- [ ] Optimize cover images and static assets.
- [ ] Paginate large lists.
- [ ] Cache safe catalog requests.
- [ ] Track frontend errors.
- [ ] Track backend errors.
- [ ] Monitor API latency and failure rates.
- [ ] Monitor file storage and processing failures.
- [ ] Monitor Gemini usage and cost.
- [ ] Health check endpoint.
- [ ] Structured application logs.
- [ ] Backup verification.
- [ ] Graceful degradation when AI or storage services are unavailable.

### 17. Testing and release quality

- [ ] Unit tests for validation, permissions, and utility functions.
- [ ] Component tests for forms, search, chat, and reader controls.
- [ ] API integration tests.
- [ ] Authentication and authorization tests.
- [ ] File upload tests.
- [ ] Gemini integration tests with mocked responses.
- [ ] End-to-end test for registration and login.
- [ ] End-to-end test for catalog search and reading.
- [ ] End-to-end test for saving and resuming a resource.
- [ ] End-to-end test for an AI question.
- [ ] End-to-end admin upload and publishing test.
- [ ] Responsive browser testing.
- [ ] Accessibility testing.
- [ ] Security review before production.
- [ ] Production build and deployment check.

## Users and roles

### Standard user: student or faculty member

- Create an account and sign in securely.
- Browse, search, and filter the catalog.
- Open permitted books and read them in the browser.
- Save resources to a personal library.
- Track reading progress and recent activity.
- Ask Gemini questions about a resource or general study topic.
- Request summaries, definitions, and study recommendations.
- Manage profile and account settings.

### Administrator

- Sign in through the same authentication system with elevated permissions.
- Create, edit, publish, archive, and delete catalog records.
- Upload and replace PDF assets.
- Manage users, roles, and account status.
- Review catalog, usage, and AI activity metrics.
- View moderation or error reports.
- Configure supported categories, courses, and subjects.

## Core feature requirements

### 1. Authentication and user management

- Registration with name, email, password, and user type where applicable.
- Secure login, logout, and session persistence.
- Password reset and email verification.
- Protected routes for authenticated users.
- Role-based permissions enforced on the server, not only in the UI.
- Admin-only routes and actions.
- Account status controls such as active, suspended, and pending verification.
- Clear loading, validation, and error states for every authentication flow.

### 2. Catalog and discovery

- Catalog landing page with featured and recently added resources.
- Search by title, author, keyword, ISBN, course, and subject.
- Filters for genre, resource type, language, publication year, and availability.
- Sort by relevance, title, author, date added, and popularity.
- Pagination or infinite loading for large catalogs.
- Empty, loading, and error states.
- Book detail page containing cover, title, author, description, subjects, course tags, publication data, file type, and reading status.
- Accessible URLs for resources so users can return to a book directly.

### 3. Browser reading experience

- Embedded PDF viewer with page navigation, zoom, search, and fullscreen support.
- Resume from the user’s last reading position.
- Save reading progress automatically.
- Open the AI assistant beside the reader on desktop and through a drawer on mobile.
- Keep the current resource and page context available to the assistant.
- Restrict document access to authorized users.
- Avoid exposing private storage URLs permanently in the browser.

### 4. Gemini AI reading assistant

- Persistent chat entry point from catalog, book detail, and reader views.
- Start a new conversation or continue a previous conversation.
- Ask general questions or questions tied to the current resource.
- Summarize a book or selected chapter when the source text is available.
- Explain complex topics in simpler language.
- Define terms and provide examples.
- Generate study questions, flashcard prompts, and reading recommendations.
- Display the resource context used for an answer where possible.
- Handle unavailable context, rate limits, unsafe requests, and API failures gracefully.
- Store conversation history only according to the privacy policy and user controls.
- Keep the Gemini API key on a trusted server or server-side function; never expose it in the React client.

### 5. Administration

- Admin dashboard with total users, active users, total resources, recent uploads, and AI usage indicators.
- Resource table with search, filters, status, and bulk-friendly actions.
- Upload flow with metadata form, file validation, progress feedback, and success/error states.
- Resource statuses: draft, published, archived, and failed processing.
- Edit metadata without re-uploading a file.
- Replace or remove a resource file safely.
- User table with role and account status controls.
- Audit trail for important admin actions.
- Confirmation steps for destructive actions.

## Suggested system architecture

The current frontend is a React and TypeScript application built with Vite. The production system should be split into clear boundaries:

```text
React client
	-> authenticated API layer
			-> authentication and authorization
			-> catalog and user services
			-> reading progress and chat services
					-> relational or document database
					-> secure object/file storage
					-> Gemini API
```

### Frontend

- React + TypeScript + Vite.
- Feature-oriented components rather than one large page component.
- Shared design tokens for colors, typography, spacing, and states.
- Route-level loading and error boundaries.
- Accessible keyboard and screen-reader interactions.
- Responsive layouts for desktop, tablet, and mobile.

### Backend

The backend technology is still a project decision. It must provide:

- Authentication and session/token handling.
- Server-side role checks.
- CRUD APIs for resources and users.
- Signed or temporary file access.
- Gemini proxy/orchestration endpoints.
- Input validation, rate limiting, structured errors, and audit logging.

### Database

Recommended starting point: a relational database because users, roles, resources, reading progress, and permissions have strong relationships. A document database is also acceptable if it better matches the chosen backend.

Initial entities:

- `users`
- `roles`
- `sessions` or authentication provider records
- `resources`
- `resource_files`
- `authors`
- `subjects` and `courses`
- `resource_tags`
- `reading_progress`
- `saved_resources`
- `chat_conversations`
- `chat_messages`
- `audit_logs`

### File storage

- Store PDFs in private object storage or a protected local storage service.
- Store file metadata separately from the file itself.
- Validate file type, size, and integrity during upload.
- Generate temporary access URLs only for authorized requests.
- Plan backups and deletion behavior before production launch.

## Security and privacy requirements

- Never commit secrets, API keys, or service credentials.
- Keep the Gemini key server-side and load it from environment variables.
- Hash passwords through a trusted authentication provider or proven library.
- Validate and sanitize all user input on the server.
- Enforce authorization for every resource, file, admin, and chat request.
- Rate-limit authentication, uploads, and AI endpoints.
- Protect against malicious PDF uploads and unsafe filenames.
- Use HTTPS in deployed environments.
- Minimize stored chat data and document the retention policy.
- Do not send private document content to Gemini unless the user is authorized and the product policy allows it.
- Add audit logs for role changes, uploads, deletions, and other sensitive actions.
- Define copyright and acceptable-use rules for uploaded academic content.

## Main application areas

### Public and authentication views

- Landing or welcome page.
- Login.
- Registration.
- Email verification.
- Password reset.

### Standard user views

- Overview dashboard.
- Catalog.
- Search results.
- Resource detail.
- PDF reader.
- My library / saved resources.
- Reading history and progress.
- AI chat history.
- Profile and settings.

### Administrator views

- Admin overview.
- Resource management.
- Add/edit resource.
- Upload processing status.
- User management.
- Categories, courses, and subjects.
- Usage metrics.
- Audit logs.

## API and integration plan

The exact backend framework is still to be selected. The eventual API should cover at least:

| Area | Example operations |
| --- | --- |
| Auth | Register, login, logout, refresh session, reset password |
| Users | Get profile, update profile, change role/status for admins |
| Resources | List, search, filter, get details, create, update, archive, delete |
| Files | Upload, validate, replace, authorize temporary read access |
| Reading | Get progress, update progress, save resource, remove saved resource |
| Chat | Create conversation, send message, list history, delete conversation |
| Metrics | Get admin dashboard counts and usage summaries |
| Audit | Record and review sensitive administrative actions |

## Delivery roadmap

### Phase 0: Decisions and foundation

- Choose the backend framework and deployment target.
- Choose the authentication provider or implementation.
- Choose the database and migration tooling.
- Choose file storage and backup strategy.
- Create development, test, and production environment conventions.
- Define the first catalog data model.

### Phase 1: Frontend foundation

- Establish routing, layout, design tokens, and shared UI components.
- Build responsive authentication screens.
- Add mock catalog data and loading/error/empty states.
- Implement catalog, resource detail, and personal library screens.

### Phase 2: Backend and catalog

- Implement authentication and protected API routes.
- Create database schema and migrations.
- Build resource CRUD and search/filter endpoints.
- Add secure PDF upload and browser access.
- Connect the React catalog to real data.

### Phase 3: Reading experience

- Integrate the PDF viewer.
- Add reading progress and saved resources.
- Add responsive reader layouts.
- Add access checks, file error handling, and activity tracking.

### Phase 4: Gemini assistant

- Create the server-side Gemini integration.
- Add chat UI and conversation persistence.
- Pass authorized resource context to Gemini.
- Add summary, definition, and recommendation actions.
- Add rate limits, failure states, and usage monitoring.
- Evaluate response quality with representative academic questions.

### Phase 5: Admin operations

- Build resource upload and management workflows.
- Add user and role management.
- Add dashboard metrics and audit logs.
- Add validation, confirmations, and permission tests.

### Phase 6: Quality and launch

- Add unit, integration, and end-to-end tests.
- Run accessibility, responsive, performance, and security reviews.
- Test large files, slow networks, API failures, and empty data states.
- Configure backups, monitoring, error reporting, and deployment.
- Write user and administrator documentation.

## Definition of done for the first release

- A verified user can sign in and access only permitted resources.
- An administrator can upload a PDF with complete metadata and publish it.
- A user can search, filter, open, and read a published PDF in the browser.
- Reading progress and saved resources persist across sessions.
- A user can ask Gemini about an authorized resource and receive a useful response.
- The API key and private files are not exposed to the client.
- Admins can manage users and resources through the dashboard.
- Critical flows have automated tests and clear error states.
- The app is usable on current desktop and mobile browsers.
- Deployment, backups, environment variables, and recovery steps are documented.

## Current project setup

This repository contains a React + TypeScript frontend powered by Vite, plus a small Node.js API for authentication. The API lives in `server/index.mjs` and requires a MySQL database created from `database/schema.sql`.

## Local development

Install Node.js 20 or newer and install the dependencies:

```bash
npm install
npm run dev
```

Available scripts:

- `npm run dev` starts the development server.
- `npm run server` starts the API at `http://localhost:3001`.
- `npm run build` type-checks and creates a production build.
- `npm run lint` checks the source files with ESLint.
- `npm run preview` serves the production build locally.

To use the API, install and start a local MySQL 8 server, then copy `.env.example` to `.env` and set the credentials. Each `npm run server` automatically creates the configured database and its missing tables without overwriting existing data. The database account needs permission to create the database; alternatively, set `DB_BOOTSTRAP_USER` and `DB_BOOTSTRAP_PASSWORD` to a MySQL account with that permission. On Windows systems where PowerShell blocks `npm.ps1`, use `npm.cmd` instead (for example, `npm.cmd run dev`). `node server.js` is also supported as an alias for the API entry point.

## Decisions to make next

- [ ] Select backend framework and hosting platform.
- [ ] Select authentication provider.
- [ ] Select database and file storage provider.
- [ ] Create the initial database schema.
- [ ] Decide whether chat history is retained, exportable, or deletable by users.
- [ ] Define maximum PDF size and supported file types.
- [ ] Define catalog moderation and copyright policy.
- [ ] Define Gemini model, token limits, rate limits, and monthly budget.
- [ ] Define analytics and privacy consent requirements.
