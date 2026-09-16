import LegalPage from '@/components/legal/LegalPage';

export default function CookiePolicyPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      description="How VeloDealer uses cookies and browser storage. We use no advertising, tracking or analytics cookies."
      lastUpdated="16 September 2026"
    >
      <section>
        <h2>1. Overview</h2>
        <p>
          VeloDealer uses the smallest possible amount of browser storage: enough to keep you signed in
          and to remember how you have arranged the screen. We do not use advertising, tracking,
          profiling or analytics cookies, and we do not share browsing data with advertisers.
        </p>
        <p>
          Because we set no non-essential cookies, no cookie consent banner is shown. Strictly
          necessary storage of this kind does not require consent under the UK Privacy and Electronic
          Communications Regulations.
        </p>
      </section>

      <section>
        <h2>2. What we store</h2>
        <ul>
          <li>
            <strong>Sign-in session</strong> (browser local storage, not a cookie) — holds the secure
            token that keeps you signed in and identifies your account to the Service. Kept until you
            sign out or clear your browser data. Strictly necessary.
          </li>
          <li>
            <strong>Menu state</strong> (cookie named <code>sidebar:state</code>) — remembers whether
            the side menu is expanded or collapsed. Expires after 7 days. Functional; it holds no
            personal information.
          </li>
        </ul>
        <p>
          That is the complete list. Nothing else is written to your device by VeloDealer.
        </p>
      </section>

      <section>
        <h2>3. Cookies set by other services</h2>
        <p>
          When you connect an external account, that provider's own sign-in pages run on their websites
          and set their own cookies, governed by their policies rather than ours:
        </p>
        <ul>
          <li>Intuit QuickBooks Online — when authorising accounting access.</li>
          <li>Shopify — when authorising a store connection.</li>
          <li>eBay — when authorising a seller account.</li>
          <li>Typeform — when authorising form access.</li>
        </ul>
        <p>
          We receive no cookies from these providers; we only receive the access tokens needed to work
          on your behalf.
        </p>
      </section>

      <section>
        <h2>4. Managing cookies</h2>
        <p>
          You can delete or block cookies and site data from your browser settings (usually under
          Privacy or Site settings), and most browsers allow you to clear data for a single site.
          Please note that removing or blocking the sign-in storage will sign you out and prevent the
          Service from working, as it is essential to authentication.
        </p>
      </section>

      <section>
        <h2>5. Changes</h2>
        <p>
          If we ever introduce additional cookies, this page will be updated first and, where the law
          requires it, we will ask for your consent before they are set.
        </p>
      </section>

      <section>
        <h2>6. Contact</h2>
        <p>
          VDMS Ltd, 30 Wake Green Road, Birmingham, B13 9PB. Email: info@velodealer.com.
        </p>
      </section>
    </LegalPage>
  );
}
