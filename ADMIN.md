# Editing the site (the admin page)

The editor lives at **`/admin`** on the site (for now: `https://abroid-dev.github.io/My-G/admin/`).
She signs in, edits her roles, education or profile text in simple forms, and presses **Publish**.
Each save becomes a commit in this repo, which rebuilds and publishes the site in about 2 minutes.

**It cannot break the live site.** The site checks every edit against its content rules when it
builds. If an edit is invalid, the build fails and the live site simply stays as it was.
Every change is saved in the repo's history, so any edit can be undone.

## What she can edit
- **Roles**: company, title, dates, what she did for the customer and for the company, results with numbers.
- **Education**: degrees, diplomas, certificates.
- **Profile and site text**: the statement, the line under her name, contact details, languages, strengths, search and link-preview text.

Not in the editor (ask the developer): her photo, the five chapters, and the five areas of expertise.

## One-time setup
1. **Give her access.** She needs a free GitHub account. In the repo go to *Settings → Collaborators → Add people* and give her **Write** access. She accepts the invite by email.
2. **Quick sign-in with a token** (works today, nothing to deploy):
   1. She opens GitHub → *Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token*.
   2. *Repository access*: **Only select repositories** → `My-G`.
   3. *Permissions → Repository permissions → Contents*: **Read and write**.
   4. Set the longest expiry offered, create the token, and copy it.
   5. At `/admin` she chooses **Sign In with Token** and pastes it. Treat the token like a password: never share it in a chat.
3. **Nicer sign-in later ("Sign in with GitHub" button).** Deploy the free sign-in helper
   [`sveltia-cms-auth`](https://github.com/sveltia/sveltia-cms-auth) on Cloudflare Workers, create a GitHub OAuth App for it,
   then put the helper's address in `public/admin/config.yml` as `base_url`. Its README has the exact steps.

## When the real domain is ready
- Update `site_url` and `display_url` in `public/admin/config.yml`.
- The admin then lives at `https://her-domain.com/admin/`.

## For the developer
- The editor is [Sveltia CMS](https://github.com/sveltia/sveltia-cms), pinned to one exact version in `public/admin/index.html`.
- Its fields mirror the schema in `src/content.config.ts`. If you add a field there, add it to `public/admin/config.yml` too, otherwise saving in the editor would drop it.
- To edit locally without signing in, open `/admin/` on `npm run dev` in Chrome or Edge and choose **Work with Local Repository**.
