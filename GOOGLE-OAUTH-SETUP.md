# Google sign-in configuration for Darsaak

The account page calls Supabase Auth with the Google provider. The frontend client is configured in `supabase.js` and now targets the `fery90game` Supabase project.

- Site origin: `https://darsaak.ir`
- Supabase project URL: `https://twchvyxflykaljyqwpvx.supabase.co`
- Google OAuth callback URI for Google Cloud Console: `https://twchvyxflykaljyqwpvx.supabase.co/auth/v1/callback`
- Supabase redirect URL to allow: `https://darsaak.ir/index.html`
- Email confirmation redirect used by sign-up: `https://darsaak.ir/auth.html`

## Required provider setup

1. In Google Cloud Console, open the OAuth client of type **Web application**.
2. Add `https://darsaak.ir` under **Authorized JavaScript origins**.
3. Add `https://twchvyxflykaljyqwpvx.supabase.co/auth/v1/callback` under **Authorized redirect URIs**.
4. In the **fery90game** Supabase project, open **Authentication → Sign In / Providers → Google**, enable Google, and enter that OAuth client's Client ID and Client Secret.
5. In **Authentication → URL Configuration**, set the Site URL to `https://darsaak.ir` and add both `https://darsaak.ir/index.html` and `https://darsaak.ir/auth.html` to Redirect URLs.
6. Save, then test sign-in and sign-up using an account you control.

Never place the Google Client Secret in website JavaScript, a Worker plain-text binding, or GitHub. It belongs only in the Supabase Google provider configuration.

The OAuth provider cannot be activated until the Google Client ID and Client Secret are entered in the Supabase dashboard. The old Supabase callback URI is no longer correct for the frontend.
