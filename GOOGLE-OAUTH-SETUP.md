# Google sign-in configuration for Darsaak

The account page now calls Supabase Auth with the Google provider. The website currently reads its Supabase URL from `supabase.js`:

- Site origin: `https://darsaak.ir`
- Supabase project URL: `https://vjofmaqhlmmfspfbfwfi.supabase.co`
- Google OAuth callback URI for Google Cloud Console: `https://vjofmaqhlmmfspfbfwfi.supabase.co/auth/v1/callback`
- Supabase Auth redirect URL to allow: `https://darsaak.ir/index.html`

## Required provider setup

1. In the Google Cloud Console OAuth client (Web application), add `https://darsaak.ir` under Authorized JavaScript origins.
2. Add the Supabase callback URI above under Authorized redirect URIs.
3. In the **same Supabase project referenced by supabase.js**, open Authentication → Sign In / Providers → Google, enable Google, and enter that OAuth client's Client ID and Client Secret.
4. In Authentication → URL Configuration, set Site URL to `https://darsaak.ir` and add `https://darsaak.ir/index.html` to Redirect URLs.
5. Save, then test sign-in using a Google account you control.

Never place the Google Client Secret in website JavaScript or commit it to GitHub. It belongs only in the Supabase Google provider configuration.

Important: the currently connected Supabase integration may point to a different project. Confirm the project ref in `supabase.js` before changing provider settings; do not configure the wrong project.
