import { Link } from "react-router-dom";

const Terms = () => (
  <div className="min-h-screen bg-background px-4 py-16">
    <div className="max-w-3xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-3 mb-12">
        <div className="w-7 h-7 bg-gradient-prism rounded-lg rotate-45 flex items-center justify-center">
          <div className="w-2.5 h-2.5 bg-white/30 rounded-sm" />
        </div>
        <span className="text-gradient-brand font-medium text-lg tracking-tight">Prism</span>
      </Link>

      <h1 className="text-4xl font-light tracking-tight mb-2">Default Terms</h1>
      <p className="text-muted-foreground mb-12">Last updated: May 23, 2026</p>

      <div className="prose prose-invert max-w-none space-y-8 text-foreground/90 leading-relaxed">
        <section>
          <h2 className="text-xl font-medium mb-3">Open-Source Software</h2>
          <p>
            Prism Salon OS is open-source software released under the MIT License. You may use,
            copy, modify, host, and distribute the software under the license terms in the
            repository.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-medium mb-3">Self-Hosted Deployments</h2>
          <p>
            A self-hosted operator controls its own deployment, database, credentials, provider
            accounts, staff access, client records, and legal policies. The default terms shown here
            are a starting point and should be customized before production use.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-medium mb-3">Accounts</h2>
          <p>
            Users are responsible for keeping their credentials secure. Salon owners are
            responsible for staff and clients they invite to their workspace.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-medium mb-3">Acceptable Use</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Do not upload content you do not have rights to use.</li>
            <li>Do not use the software to harass, defraud, or violate the law.</li>
            <li>Do not attempt to bypass authentication, authorization, or provider security.</li>
            <li>Do not send messages without the consent required by applicable law.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-medium mb-3">Payments</h2>
          <p>
            Payment features use the operator&apos;s Stripe account. The salon or deployment
            operator is responsible for refunds, chargebacks, disputes, taxes, provider fees, and
            payment compliance.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-medium mb-3">Client Data</h2>
          <p>
            The deployment operator is responsible for the client records, photos, appointments,
            forms, messages, and other data stored in its Supabase project and third-party provider
            accounts.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-medium mb-3">No Warranty</h2>
          <p>
            The software is provided &quot;as is&quot; without warranty of any kind. Review the MIT
            License for the full warranty and liability disclaimer.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-medium mb-3">Customize Before Launch</h2>
          <p>
            Replace these default terms with policies reviewed for your business, jurisdiction,
            provider contracts, payment flow, SMS/email practices, and data-retention requirements.
          </p>
        </section>
      </div>

      <div className="mt-16 pt-8 border-t border-border/40 flex gap-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
      </div>
    </div>
  </div>
);

export default Terms;
